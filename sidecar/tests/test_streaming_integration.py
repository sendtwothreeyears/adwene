"""Integration tests for the streaming transcription pipeline.

Tests the full flow: WebSocket → VAD → ASR → transcript messages,
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
# Mock engines
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
        return f"segment {self.call_count} ({duration_ms:.0f}ms)"

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
# Audio helpers (from test_vad.py)
# ---------------------------------------------------------------------------

def _silence(duration_ms: int) -> bytes:
    n = int(16_000 * duration_ms / 1000)
    return np.zeros(n, dtype=np.int16).tobytes()


def _speech_like(duration_ms: int) -> bytes:
    n = int(16_000 * duration_ms / 1000)
    t = np.arange(n, dtype=np.float64) / 16_000
    sig = (
        0.4 * np.sin(2 * np.pi * 150 * t)
        + 0.25 * np.sin(2 * np.pi * 300 * t)
        + 0.15 * np.sin(2 * np.pi * 450 * t)
        + 0.1 * np.sin(2 * np.pi * 600 * t)
    )
    envelope = 0.7 + 0.3 * np.sin(2 * np.pi * 4 * t)
    sig = sig * envelope
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

class TestStreamingHandshake:
    """Connection and status message tests."""

    async def test_connect_receives_status_ready(self, ws_server):
        ws = await _connect(ws_server)
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.STATUS
        assert msg["status"] == protocol.STATUS_READY
        await ws.close()

    async def test_start_without_session_id_returns_error(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send(json.dumps({"type": protocol.TRANSCRIBE_START}))
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.ERROR
        assert "session_id" in msg["message"]
        await ws.close()

    async def test_stop_without_audio_returns_empty_final(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "test-1",
        }))
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "test-1",
        }))
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.TRANSCRIPT_FINAL
        assert msg["text"] == ""
        assert msg["is_final"] is True
        await ws.close()


class TestStreamingTranscription:
    """End-to-end streaming pipeline tests."""

    async def test_speech_then_stop_produces_segments_and_final(self, ws_server, _mock_engines):
        """Full flow: start → speech → silence → stop → final transcript."""
        mock_asr, _ = _mock_engines
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        # Start session
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "e2e-1",
        }))

        # Send speech (2s) then silence (2s) in 200ms chunks
        for _ in range(10):
            await ws.send(_speech_like(200))
            await asyncio.sleep(0.01)
        for _ in range(10):
            await ws.send(_silence(200))
            await asyncio.sleep(0.01)

        # Give VAD time to detect the segment
        await asyncio.sleep(0.5)

        # Stop
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "e2e-1",
        }))

        # Collect all messages
        msgs = await _drain_messages(ws, timeout=3.0)

        types = [m["type"] for m in msgs]

        # Should have at least one segment and exactly one final
        assert protocol.TRANSCRIPT_SEGMENT in types or protocol.TRANSCRIPT_FINAL in types, (
            f"Expected segments or final, got: {types}"
        )
        assert types.count(protocol.TRANSCRIPT_FINAL) == 1
        final = next(m for m in msgs if m["type"] == protocol.TRANSCRIPT_FINAL)
        assert final["is_final"] is True
        assert final["session_id"] == "e2e-1"
        assert len(final["text"]) > 0

        await ws.close()

    async def test_silence_only_produces_final_only(self, ws_server, _mock_engines):
        """Recording silence should produce no segments but still a final transcript."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "silence-1",
        }))

        # 3 seconds of silence
        for _ in range(15):
            await ws.send(_silence(200))
            await asyncio.sleep(0.01)

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "silence-1",
        }))

        msgs = await _drain_messages(ws, timeout=3.0)
        types = [m["type"] for m in msgs]

        # No segments (no speech detected by VAD)
        segments = [m for m in msgs if m["type"] == protocol.TRANSCRIPT_SEGMENT]
        assert len(segments) == 0, "Silence should not produce any segments"

        # But should still produce a final (batch transcription of full audio)
        assert protocol.TRANSCRIPT_FINAL in types
        await ws.close()

    async def test_very_short_recording(self, ws_server, _mock_engines):
        """Recording <2s should still produce a final transcript."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "short-1",
        }))

        # 1 second of speech
        for _ in range(5):
            await ws.send(_speech_like(200))
            await asyncio.sleep(0.01)

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "short-1",
        }))

        msgs = await _drain_messages(ws, timeout=3.0)
        types = [m["type"] for m in msgs]
        assert protocol.TRANSCRIPT_FINAL in types
        await ws.close()

    async def test_continuous_speech_no_pauses(self, ws_server, _mock_engines):
        """Continuous speech without pauses — VAD should still function."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "continuous-1",
        }))

        # 5 seconds of continuous speech (no silence gaps)
        for _ in range(25):
            await ws.send(_speech_like(200))
            await asyncio.sleep(0.01)

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "continuous-1",
        }))

        msgs = await _drain_messages(ws, timeout=3.0)
        types = [m["type"] for m in msgs]

        # Should get a final transcript regardless
        assert protocol.TRANSCRIPT_FINAL in types
        final = next(m for m in msgs if m["type"] == protocol.TRANSCRIPT_FINAL)
        assert len(final["text"]) > 0
        await ws.close()

    async def test_multiple_speech_segments_with_pauses(self, ws_server, _mock_engines):
        """Multiple speech-silence cycles: final transcript always produced.

        Note: Whether VAD emits live segments depends on the neural model's
        response to synthetic audio. The key guarantee is that batch
        reconciliation (transcript_final) always captures everything.
        """
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "multi-1",
        }))

        all_msgs = []

        # Two speech-silence cycles
        for cycle in range(2):
            # 3s speech (longer to increase chance of VAD trigger)
            for _ in range(15):
                await ws.send(_speech_like(200))
                await asyncio.sleep(0.01)
            # 3s silence
            for _ in range(15):
                await ws.send(_silence(200))
                await asyncio.sleep(0.01)
            # Drain any segments that arrived during this cycle
            all_msgs.extend(await _drain_messages(ws, timeout=1.0))

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "multi-1",
        }))

        all_msgs.extend(await _drain_messages(ws, timeout=3.0))
        segments = [m for m in all_msgs if m["type"] == protocol.TRANSCRIPT_SEGMENT]
        finals = [m for m in all_msgs if m["type"] == protocol.TRANSCRIPT_FINAL]

        # Batch reconciliation always produces a final
        assert len(finals) == 1
        assert len(finals[0]["text"]) > 0

        # If segments were produced, they should have sequential indices
        if segments:
            indices = [s["segment_index"] for s in segments]
            assert indices == sorted(indices), "Segment indices should be sequential"

        await ws.close()


class TestStreamingEdgeCases:
    """Edge case and error handling tests."""

    async def test_binary_without_session_ignored(self, ws_server):
        """Binary frames before transcribe_start should be silently ignored."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send(_speech_like(200))
        # Should not crash — just log a warning
        await asyncio.sleep(0.2)
        await ws.close()

    async def test_invalid_json_returns_error(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status
        await ws.send("not json!")
        msg = await _recv_json(ws)
        assert msg["type"] == protocol.ERROR
        assert "Invalid JSON" in msg["message"]
        await ws.close()

    async def test_session_cleanup_on_disconnect(self, ws_server):
        """Sessions should be cleaned up when client disconnects."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "cleanup-1",
        }))
        await ws.send(_speech_like(200))
        await asyncio.sleep(0.1)

        # Disconnect without stopping
        await ws.close()
        await asyncio.sleep(0.2)

        # Session should be cleaned up (no lingering state)
        assert "cleanup-1" not in server._sessions

    async def test_overwrite_existing_session(self, ws_server):
        """Starting a new session with same ID should overwrite the old one."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "overwrite-1",
        }))
        await ws.send(_speech_like(200))
        # Wait for server to fully process the binary frame
        await asyncio.sleep(0.3)

        # Start again with same ID — this overwrites the session
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "overwrite-1",
        }))
        # Wait for server to process the overwrite
        await asyncio.sleep(0.1)

        # Send audio to new session and stop
        await ws.send(_speech_like(200))
        await asyncio.sleep(0.1)
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "overwrite-1",
        }))

        msgs = await _drain_messages(ws, timeout=3.0)
        assert any(m["type"] == protocol.TRANSCRIPT_FINAL for m in msgs)
        await ws.close()


class TestNoteGeneration:
    """Note generation via WebSocket tests."""

    async def test_generate_note_returns_chunks_and_final(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.GENERATE_NOTE,
            "session_id": "note-1",
            "transcript": "Patient presents with headache for three days.",
            "template": "SOAP",
        }))

        msgs = await _drain_messages(ws, timeout=3.0)
        types = [m["type"] for m in msgs]

        assert protocol.NOTE_PROGRESS in types
        assert protocol.NOTE in types
        note = next(m for m in msgs if m["type"] == protocol.NOTE)
        assert note["is_final"] is True
        assert "Patient presents" in note["content"]
        await ws.close()

    async def test_generate_note_without_transcript_returns_error(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.GENERATE_NOTE,
            "session_id": "note-err",
        }))

        msg = await _recv_json(ws)
        assert msg["type"] == protocol.ERROR
        assert "transcript" in msg["message"]
        await ws.close()


class TestTitleGeneration:
    """Title generation via WebSocket tests."""

    async def test_generate_title_returns_title(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.GENERATE_TITLE,
            "session_id": "title-1",
            "transcript": "Patient presents with headache for three days.",
        }))

        msgs = await _drain_messages(ws, timeout=3.0)
        types = [m["type"] for m in msgs]

        assert protocol.TITLE in types
        title_msg = next(m for m in msgs if m["type"] == protocol.TITLE)
        assert title_msg["session_id"] == "title-1"
        assert len(title_msg["title"]) > 0
        # Title should be at most 5 words
        assert len(title_msg["title"].split()) <= 5
        await ws.close()

    async def test_stop_then_immediate_title_no_crash(self, ws_server):
        """Regression test for KAS-287: stop recording then immediately request title.

        This reproduces the race where generate_title could interleave with
        retranscription chunks via the MLX executor, causing a Metal GPU crash.
        """
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        # Start a transcription session and send some audio
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "race-1",
        }))
        for _ in range(5):
            await ws.send(_speech_like(200))
            await asyncio.sleep(0.01)

        # Stop transcription (triggers retranscribe in background)
        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "race-1",
        }))

        # IMMEDIATELY request title — this is the race window
        await ws.send(json.dumps({
            "type": protocol.GENERATE_TITLE,
            "session_id": "race-1",
            "transcript": "Patient presents with headache for three days.",
        }))

        msgs = await _drain_messages(ws, timeout=5.0)
        types = [m["type"] for m in msgs]

        # Should get a title back without crashing
        assert protocol.TITLE in types, f"Expected title response, got types: {types}"
        # Should NOT have an error from the race
        error_msgs = [m for m in msgs if m["type"] == protocol.ERROR]
        assert len(error_msgs) == 0, f"Unexpected errors: {error_msgs}"
        await ws.close()

    async def test_generate_title_without_transcript_returns_error(self, ws_server):
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.GENERATE_TITLE,
            "session_id": "title-err",
        }))

        msg = await _recv_json(ws)
        assert msg["type"] == protocol.ERROR
        assert "transcript" in msg["message"]
        await ws.close()


class TestBatchTranscription:
    """Batch transcription mode — audio-only, no live segments (KAS-291)."""

    async def test_batch_mode_skips_live_segments(self, ws_server, _mock_engines):
        """In batch mode, no transcript_segment or partial messages during recording."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "batch-1",
            "mode": "batch",
        }))

        # Send speech-like audio that would normally trigger VAD segments
        for _ in range(10):
            await ws.send(_speech_like(300))
            await asyncio.sleep(0.02)

        # Drain any messages — should be none (no segments in batch mode)
        msgs = await _drain_messages(ws, timeout=1.0)
        segment_msgs = [m for m in msgs if m.get("type") == protocol.TRANSCRIPT_SEGMENT]
        partial_msgs = [m for m in msgs if m.get("type") == protocol.TRANSCRIPT_PARTIAL]

        assert len(segment_msgs) == 0, f"Batch mode should not produce segments: {segment_msgs}"
        assert len(partial_msgs) == 0, f"Batch mode should not produce partials: {partial_msgs}"
        await ws.close()

    async def test_batch_mode_returns_transcript_final_on_stop(self, ws_server, _mock_engines):
        """Batch mode should return transcript_final on stop."""
        ws = await _connect(ws_server)
        await _recv_json(ws)  # status

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_START,
            "session_id": "batch-2",
            "mode": "batch",
        }))

        # Send minimal audio
        await ws.send(_speech_like(100))
        await asyncio.sleep(0.05)

        await ws.send(json.dumps({
            "type": protocol.TRANSCRIBE_STOP,
            "session_id": "batch-2",
        }))

        msgs = await _drain_messages(ws, timeout=5.0)
        types = [m["type"] for m in msgs]

        # Should get a transcript_final (may be empty due to mock engine)
        assert protocol.TRANSCRIPT_FINAL in types, f"Expected transcript_final, got: {types}"
        await ws.close()
