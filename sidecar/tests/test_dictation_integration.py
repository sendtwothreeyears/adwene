"""Integration tests for the dictation pipeline.

Tests the dictation flow: dictate_start → binary audio → dictate_stop → dictate_result,
using a mock ASR engine to avoid loading real models.
"""

import asyncio
import json
from collections.abc import AsyncIterator
from unittest.mock import patch

import numpy as np
import pytest
import pytest_asyncio
import websockets

from sidecar.src import protocol, server
from sidecar.src.engines.base import ASREngine, NoteEngine


# ---------------------------------------------------------------------------
# Mock engines (reused from test_streaming_integration)
# ---------------------------------------------------------------------------

class MockASREngine(ASREngine):
    """Deterministic ASR engine that returns canned text."""

    def __init__(self):
        self.call_count = 0

    async def load(self) -> None:
        pass

    async def transcribe(self, audio_chunk: bytes) -> str:
        self.call_count += 1
        duration_ms = len(audio_chunk) / (16_000 * 2) * 1000
        return f"dictated segment {self.call_count} ({duration_ms:.0f}ms)"

    async def unload(self) -> None:
        pass


class MockNoteEngine(NoteEngine):
    """Deterministic note engine."""

    async def load(self) -> None:
        pass

    async def generate(self, transcript: str, template: str, context: str = "") -> str:
        return f"Note for: {transcript[:50]}"

    async def generate_stream(self, transcript: str, template: str, context: str = "") -> AsyncIterator[str]:
        text = await self.generate(transcript, template)
        yield text

    async def unload(self) -> None:
        pass


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def _speech_like(duration_ms: int) -> bytes:
    """Generate speech-like audio for testing."""
    n = int(16_000 * duration_ms / 1000)
    t = np.arange(n, dtype=np.float64) / 16_000
    sig = (
        0.4 * np.sin(2 * np.pi * 150 * t)
        + 0.25 * np.sin(2 * np.pi * 300 * t)
        + 0.15 * np.sin(2 * np.pi * 450 * t)
    )
    return (sig * 32767).astype(np.int16).tobytes()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def _mock_engines():
    """Patch the global engine instances and mark them as ready."""
    mock_asr = MockASREngine()
    mock_note = MockNoteEngine()

    with (
        patch.object(server, "_asr_engine", mock_asr),
        patch.object(server, "_note_engine", mock_note),
        patch.object(server, "_engines_ready", asyncio.Event()),
    ):
        server._engines_ready.set()
        yield mock_asr, mock_note


@pytest_asyncio.fixture()
async def ws_server(_mock_engines):
    """Start a real WebSocket server on a random port with mocked engines."""
    srv = await websockets.serve(server.handler, "localhost", 0)
    port = srv.sockets[0].getsockname()[1]
    yield port
    srv.close()
    await srv.wait_closed()


async def _connect(port: int):
    return await websockets.connect(f"ws://localhost:{port}")


async def _recv_json(ws, timeout: float = 5.0) -> dict:
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def _drain_messages(ws, timeout: float = 0.5) -> list[dict]:
    """Collect all pending messages until timeout."""
    msgs = []
    try:
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
            msgs.append(json.loads(raw))
    except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
        pass
    return msgs


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDictationHandshake:
    """Dictation start/stop without audio."""

    async def test_dictate_start_without_session_id_returns_error(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send(json.dumps({"type": protocol.DICTATE_START}))
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.ERROR
        assert "session_id" in msg["message"]
        await ws.close()

    async def test_dictate_stop_with_no_audio_returns_empty(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send(json.dumps({
            "type": protocol.DICTATE_START,
            "session_id": "dict-1",
        }))
        await ws.send(json.dumps({
            "type": protocol.DICTATE_STOP,
            "session_id": "dict-1",
        }))
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.DICTATE_RESULT
        assert msg["session_id"] == "dict-1"
        assert msg["text"] == ""
        await ws.close()

    async def test_dictate_stop_with_very_short_audio_returns_empty(self, ws_server):
        """Audio shorter than 2240 samples (~140ms) should return empty."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send(json.dumps({
            "type": protocol.DICTATE_START,
            "session_id": "dict-short",
        }))
        # Send very short audio (50ms = 800 samples = 1600 bytes)
        short_audio = _speech_like(50)
        await ws.send(short_audio)
        await ws.send(json.dumps({
            "type": protocol.DICTATE_STOP,
            "session_id": "dict-short",
        }))
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.DICTATE_RESULT
        assert msg["text"] == ""
        await ws.close()


class TestDictationTranscription:
    """End-to-end dictation flow tests."""

    async def test_dictation_full_flow(self, ws_server, _mock_engines):
        """dictate_start → audio chunks → dictate_stop → dictate_result with text."""
        mock_asr, _ = _mock_engines
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        # Start dictation
        await ws.send(json.dumps({
            "type": protocol.DICTATE_START,
            "session_id": "dict-full",
        }))

        # Send 2 seconds of speech-like audio in 100ms chunks
        for _ in range(20):
            await ws.send(_speech_like(100))

        # Stop dictation
        await ws.send(json.dumps({
            "type": protocol.DICTATE_STOP,
            "session_id": "dict-full",
        }))

        # Should receive dictate_result
        msg = await _recv_json(ws, timeout=10.0)
        assert msg["type"] == protocol.DICTATE_RESULT
        assert msg["session_id"] == "dict-full"
        assert len(msg["text"]) > 0  # Non-empty transcription
        await ws.close()

    async def test_dictation_does_not_interfere_with_transcription_sessions(self, ws_server):
        """Dictation sessions are tracked separately from transcription sessions."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        # Start dictation
        await ws.send(json.dumps({
            "type": protocol.DICTATE_START,
            "session_id": "dict-isolated",
        }))
        # Small delay to let server process the message
        await asyncio.sleep(0.1)

        # Verify no streaming session was created
        assert "dict-isolated" not in server._sessions

        # Stop dictation and verify we get a result (not a transcription message)
        await ws.send(json.dumps({
            "type": protocol.DICTATE_STOP,
            "session_id": "dict-isolated",
        }))
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.DICTATE_RESULT
        assert msg["session_id"] == "dict-isolated"
        await ws.close()

    async def test_connection_close_during_dictation(self, ws_server):
        """Closing connection during dictation doesn't crash the server."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.DICTATE_START,
            "session_id": "dict-orphan",
        }))
        await ws.send(_speech_like(500))

        # Close connection abruptly — server should handle gracefully
        await ws.close()
        await asyncio.sleep(0.2)

        # Verify server is still functional by connecting again
        ws2 = await _connect(ws_server)
        msg = await _recv_json(ws2)
        assert msg["type"] == protocol.STATUS
        await ws2.close()
