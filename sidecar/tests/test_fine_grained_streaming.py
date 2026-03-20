"""Integration test for fine-grained backend streaming (KAS-285).

Mocks mlx-vlm's stream_generate and the tokenizer to verify that
MedGemmaEngine.generate_stream() produces near-token-level chunks
instead of SPM word-boundary bursts.
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


# Simulated token vocabulary: each token ID maps to a string fragment
TOKEN_TABLE = {
    1: "# ",
    2: "Sub",
    3: "ject",
    4: "ive",
    5: "\n",
    6: "Patient",
    7: " reports",
    8: " head",
    9: "ache",
    10: ".",
}

GENERATED_TOKEN_IDS = list(TOKEN_TABLE.keys())
EXPECTED_FULL_TEXT = "".join(TOKEN_TABLE.values())


def _fake_tokenizer():
    """Build a mock tokenizer that decodes from TOKEN_TABLE."""
    tok = MagicMock()

    def decode(ids, skip_special_tokens=False):
        return "".join(TOKEN_TABLE.get(tid, "") for tid in ids)

    tok.decode = decode
    return tok


def _fake_stream_generate(model, processor, prompt, **kwargs):
    """Yield GenerationResult-like objects with .token and .text fields."""
    for tid in GENERATED_TOKEN_IDS:
        yield SimpleNamespace(
            token=tid,
            # .text simulates SPM buffering: whole words only (deliberately coarse)
            text=TOKEN_TABLE[tid] if " " in TOKEN_TABLE[tid] or TOKEN_TABLE[tid] == "\n" else "",
        )


class TestFineGrainedStreaming:
    """Verify generate_stream() produces fine-grained chunks via manual decode."""

    @pytest.fixture
    def engine(self):
        """Create a MedGemmaEngine with mocked model/processor."""
        from sidecar.src.engines.medgemma_engine import MedGemmaEngine

        eng = MedGemmaEngine()
        eng._model = MagicMock()
        eng._model.config = SimpleNamespace(model_type="gemma3")
        eng._processor = MagicMock()
        eng._processor.tokenizer = _fake_tokenizer()
        return eng

    @pytest.fixture
    def mock_executor(self):
        """Patch _mlx_executor so run_in_executor uses a thread."""
        with patch("sidecar.src.engines.medgemma_engine.config") as mock_config:
            mock_config.MEDGEMMA_MAX_TOKENS = 1024
            mock_config.MEDGEMMA_TEMPERATURE = 0.7
            mock_config.MEDGEMMA_REPETITION_PENALTY = 1.0
            mock_config.MEDGEMMA_REPETITION_CONTEXT_SIZE = 256
            mock_config.MEDGEMMA_TOP_P = 0.95
            yield mock_config

    async def test_chunks_are_fine_grained(self, engine, mock_executor):
        """Each chunk should be small (1-5 chars typically), not full words/sentences."""
        chunks: list[str] = []

        with (
            patch("mlx_vlm.stream_generate", side_effect=_fake_stream_generate),
            patch("sidecar.src.server._mlx_executor", None),
        ):
            async for chunk in engine.generate_stream(
                transcript="test", template="SOAP"
            ):
                chunks.append(chunk)

        # Verify we got multiple chunks (not one big blob)
        assert len(chunks) >= 5, f"Expected >=5 fine-grained chunks, got {len(chunks)}: {chunks}"

        # Verify all chunks are small (near-token granularity)
        for chunk in chunks:
            assert len(chunk) <= 10, f"Chunk too large ({len(chunk)} chars): {chunk!r}"

        # Verify concatenation equals the full expected text
        assert "".join(chunks) == EXPECTED_FULL_TEXT

    async def test_ufffd_chunks_are_skipped(self, engine, mock_executor):
        """Chunks containing replacement character should be deferred."""
        # Override tokenizer to produce \ufffd on token 3, resolved on token 4
        original_decode = engine._processor.tokenizer.decode

        def decode_with_ufffd(ids, skip_special_tokens=False):
            text = original_decode(ids, skip_special_tokens=skip_special_tokens)
            # Simulate incomplete UTF-8 when only tokens 1-3 are decoded
            if len(ids) == 3:
                return text[:-3] + "\ufffd"
            return text

        engine._processor.tokenizer.decode = decode_with_ufffd

        chunks: list[str] = []
        with (
            patch("mlx_vlm.stream_generate", side_effect=_fake_stream_generate),
            patch("sidecar.src.server._mlx_executor", None),
        ):
            async for chunk in engine.generate_stream(
                transcript="test", template="SOAP"
            ):
                chunks.append(chunk)

        # No chunk should contain replacement character
        for chunk in chunks:
            assert "\ufffd" not in chunk, f"Chunk contains replacement char: {chunk!r}"

        # Full text should still be complete (deferred bytes caught up)
        assert "".join(chunks) == EXPECTED_FULL_TEXT
