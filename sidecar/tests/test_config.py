"""Tests for generation parameter defaults in config."""

from sidecar.src import config


class TestMedGemmaConfigDefaults:
    """Verify tuned generation param defaults."""

    def test_temperature(self):
        assert config.MEDGEMMA_TEMPERATURE == 0.35

    def test_repetition_penalty(self):
        assert config.MEDGEMMA_REPETITION_PENALTY == 1.05

    def test_top_p(self):
        assert config.MEDGEMMA_TOP_P == 0.65

    def test_max_tokens(self):
        assert config.MEDGEMMA_MAX_TOKENS == 1500

    def test_repetition_context_size_unchanged(self):
        assert config.MEDGEMMA_REPETITION_CONTEXT_SIZE == 128


class TestAudioBufferConfig:
    """Verify audio buffer configuration defaults."""

    def test_default_buffer_mb(self):
        assert config.MAX_AUDIO_BUFFER_MB == 60.0

    def test_buffer_bytes_calculation(self):
        """Buffer bytes should match MB * 1024 * 1024."""
        from sidecar.src.server import _MAX_FULL_AUDIO_BYTES

        expected = int(60.0 * 1024 * 1024)
        assert _MAX_FULL_AUDIO_BYTES == expected

    def test_buffer_supports_30_min(self):
        """60 MB buffer covers ~32 minutes at 16kHz 16-bit mono."""
        from sidecar.src.server import _MAX_FULL_AUDIO_BYTES

        thirty_min_bytes = 30 * 60 * 16_000 * 2  # 57.6 MB
        assert _MAX_FULL_AUDIO_BYTES > thirty_min_bytes
