"""Tests for chunked spectrogram extraction."""

import numpy as np
import pytest

from sidecar.src.engines.medasr_mlx_engine import (
    _extract_features,
    _extract_features_chunked,
    _linear_to_mel_weight_matrix,
)

SAMPLE_RATE = 16_000


@pytest.fixture
def mel_filters():
    """Pre-compute mel filter bank (same as engine init)."""
    return _linear_to_mel_weight_matrix(
        num_mel_bins=128,
        num_spectrogram_bins=257,
        sample_rate=SAMPLE_RATE,
    )


class TestChunkedFeatureExtraction:
    """Verify chunked extraction matches single-pass within tolerance."""

    def test_short_audio_identical(self, mel_filters):
        """Audio shorter than one chunk should produce identical output."""
        audio = np.random.randn(SAMPLE_RATE * 5).astype(np.float32)  # 5 seconds
        single = _extract_features(audio, mel_filters)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)
        np.testing.assert_array_equal(single, chunked)

    def test_exact_one_chunk_identical(self, mel_filters):
        """Audio exactly one chunk long should match single-pass."""
        audio = np.random.randn(SAMPLE_RATE * 20).astype(np.float32)  # 20 seconds
        single = _extract_features(audio, mel_filters)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)
        np.testing.assert_array_equal(single, chunked)

    def test_two_chunks_close_to_single_pass(self, mel_filters):
        """30-second audio chunked at 20s should be close to single-pass."""
        audio = np.random.randn(SAMPLE_RATE * 30).astype(np.float32)
        single = _extract_features(audio, mel_filters)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)

        # Shapes should match (same number of time frames).
        assert single.shape == chunked.shape, (
            f"Shape mismatch: single={single.shape}, chunked={chunked.shape}"
        )

        # Values should be very close — float32 arithmetic at boundaries
        # may produce minor differences.
        np.testing.assert_allclose(single, chunked, atol=1e-4, rtol=1e-4)

    def test_many_chunks_close_to_single_pass(self, mel_filters):
        """60-second audio chunked at 20s (3 chunks) should match."""
        audio = np.random.randn(SAMPLE_RATE * 60).astype(np.float32)
        single = _extract_features(audio, mel_filters)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)

        assert single.shape == chunked.shape, (
            f"Shape mismatch: single={single.shape}, chunked={chunked.shape}"
        )
        np.testing.assert_allclose(single, chunked, atol=1e-4, rtol=1e-4)

    def test_small_chunk_size(self, mel_filters):
        """Very small chunks (2s) should still produce correct output."""
        audio = np.random.randn(SAMPLE_RATE * 10).astype(np.float32)
        single = _extract_features(audio, mel_filters)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=2.0)

        assert single.shape == chunked.shape, (
            f"Shape mismatch: single={single.shape}, chunked={chunked.shape}"
        )
        np.testing.assert_allclose(single, chunked, atol=1e-4, rtol=1e-4)

    def test_output_dtype_is_float32(self, mel_filters):
        """Chunked output should be float32."""
        audio = np.random.randn(SAMPLE_RATE * 25).astype(np.float32)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)
        assert chunked.dtype == np.float32

    def test_empty_audio(self, mel_filters):
        """Empty audio should return a single zero frame."""
        audio = np.array([], dtype=np.float32)
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)
        assert chunked.shape == (1, 128)
        assert np.all(chunked == 0)

    def test_very_short_audio(self, mel_filters):
        """Audio shorter than one STFT window should return a zero frame."""
        audio = np.random.randn(100).astype(np.float32)  # < win_length=400
        chunked = _extract_features_chunked(audio, mel_filters, chunk_duration=20.0)
        assert chunked.shape == (1, 128)
