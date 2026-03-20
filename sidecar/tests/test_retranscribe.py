"""Tests for the async re-transcription pipeline (KAS-278).

Uses mock ASR engine to verify:
- Retranscription triggers after recording stops
- Cooperative cancellation works between encoder chunks
- WebSocket disconnection is handled gracefully
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from sidecar.src import protocol, server


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_audio_bytes(duration_s: float = 5.0) -> bytes:
    """Generate PCM Int16 bytes of the given duration at 16kHz."""
    n = int(16_000 * duration_s)
    # Simple sine wave — content doesn't matter, mock engine ignores it
    t = np.arange(n, dtype=np.float32) / 16_000
    sig = (0.5 * np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    return sig.tobytes()


class MockWebSocket:
    """Minimal WebSocket mock that records sent messages."""

    def __init__(self):
        self.sent: list[str] = []
        self.closed = False

    async def send(self, data: str) -> None:
        if self.closed:
            import websockets.exceptions
            raise websockets.exceptions.ConnectionClosed(None, None)
        self.sent.append(data)

    def get_messages(self) -> list[dict]:
        return [json.loads(s) for s in self.sent]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRetranscribe:
    """Test the _retranscribe coroutine."""

    @pytest.fixture(autouse=True)
    def _setup_engine(self):
        """Patch the global ASR engine with a mock that returns known logprobs."""
        mock_engine = MagicMock()

        # _encode_chunk_sync returns a fake logprob array
        # Shape: (T, vocab_size) — we use small values for testing
        def fake_encode(audio_chunk):
            # Produce ~1 frame per 160 samples (hop_length)
            n_frames = max(1, len(audio_chunk) // 160)
            return np.zeros((n_frames, 512), dtype=np.float16)

        mock_engine._encode_chunk_sync = fake_encode
        mock_engine.decode_logprobs = MagicMock(return_value=("refined transcript text", -123.4, -56.7))

        with patch.object(server, "_asr_engine", mock_engine):
            yield mock_engine

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        """Clean up global state after each test."""
        yield
        server._retranscribe_cancel.clear()
        server._retranscribe_tasks.clear()

    @pytest.mark.asyncio
    async def test_emits_refining_then_refined(self, _setup_engine):
        """Should emit transcript_refining at start and transcript_refined at end."""
        ws = MockWebSocket()
        audio = _make_audio_bytes(5.0)

        await server._retranscribe(ws, "sess-1", audio, "original text")

        msgs = ws.get_messages()
        types = [m["type"] for m in msgs]

        assert protocol.TRANSCRIPT_REFINING in types
        assert protocol.TRANSCRIPT_REFINED in types

        # Refining should come before refined
        assert types.index(protocol.TRANSCRIPT_REFINING) < types.index(protocol.TRANSCRIPT_REFINED)

        # Refined message should contain the decoded text and scores
        refined = next(m for m in msgs if m["type"] == protocol.TRANSCRIPT_REFINED)
        assert refined["text"] == "refined transcript text"
        assert refined["session_id"] == "sess-1"
        assert refined["segment_text"] == "original text"
        assert "logit_score" in refined
        assert "lm_score" in refined

    @pytest.mark.asyncio
    async def test_calls_encoder_in_chunks(self, _setup_engine):
        """Should call _encode_chunk_sync for each chunk of audio."""
        ws = MockWebSocket()
        # 25 seconds of audio — should be split into multiple chunks at 20s
        audio = _make_audio_bytes(25.0)
        mock_engine = _setup_engine

        call_count = 0
        original_encode = mock_engine._encode_chunk_sync

        def counting_encode(audio_chunk):
            nonlocal call_count
            call_count += 1
            return original_encode(audio_chunk)

        mock_engine._encode_chunk_sync = counting_encode

        await server._retranscribe(ws, "sess-2", audio, "original")

        # Should have been called more than once (chunked)
        assert call_count >= 2

    @pytest.mark.asyncio
    async def test_calls_decode_with_beam_100(self, _setup_engine):
        """Decoder should be called with beam_width=100."""
        ws = MockWebSocket()
        audio = _make_audio_bytes(5.0)
        mock_engine = _setup_engine

        await server._retranscribe(ws, "sess-3", audio, "original")

        mock_engine.decode_logprobs.assert_called_once()
        args = mock_engine.decode_logprobs.call_args
        assert args[0][1] == 100  # beam_width

    @pytest.mark.asyncio
    async def test_cooperative_cancellation(self, _setup_engine):
        """Should abort when cancel flag is set between chunks."""
        ws = MockWebSocket()
        audio = _make_audio_bytes(25.0)
        mock_engine = _setup_engine

        chunk_count = 0
        original_encode = mock_engine._encode_chunk_sync

        def cancelling_encode(audio_chunk):
            nonlocal chunk_count
            chunk_count += 1
            if chunk_count >= 2:
                # Set cancel flag after first chunk
                server._retranscribe_cancel["sess-cancel"] = True
            return original_encode(audio_chunk)

        mock_engine._encode_chunk_sync = cancelling_encode

        await server._retranscribe(ws, "sess-cancel", audio, "original")

        # Should NOT have emitted transcript_refined (cancelled)
        msgs = ws.get_messages()
        types = [m["type"] for m in msgs]
        assert protocol.TRANSCRIPT_REFINED not in types

    @pytest.mark.asyncio
    async def test_handles_disconnected_websocket(self, _setup_engine):
        """Should handle ConnectionClosed gracefully."""
        ws = MockWebSocket()
        ws.closed = True  # Simulate disconnected client
        audio = _make_audio_bytes(5.0)

        # Should not raise
        await server._retranscribe(ws, "sess-dc", audio, "original")

    @pytest.mark.asyncio
    async def test_short_audio_skipped(self, _setup_engine):
        """Audio shorter than _MIN_SAMPLES should be skipped."""
        ws = MockWebSocket()
        # Very short audio — less than 2240 samples
        audio = np.zeros(100, dtype=np.int16).tobytes()

        await server._retranscribe(ws, "sess-short", audio, "original")

        # Should have emitted refining but no refined (skipped)
        msgs = ws.get_messages()
        types = [m["type"] for m in msgs]
        # Only refining message at most
        assert protocol.TRANSCRIPT_REFINED not in types
