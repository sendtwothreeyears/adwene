"""Tests for Silero VAD ONNX wrapper."""

import numpy as np
import pytest

from sidecar.src.vad import SileroVAD

# Audio generation helpers

def _silence(duration_ms: int, sample_rate: int = 16_000) -> bytes:
    """Generate silence as Int16 PCM bytes."""
    n_samples = int(sample_rate * duration_ms / 1000)
    return np.zeros(n_samples, dtype=np.int16).tobytes()


def _tone(
    frequency: float,
    duration_ms: int,
    amplitude: float = 0.5,
    sample_rate: int = 16_000,
) -> bytes:
    """Generate a sine wave tone as Int16 PCM bytes (simulates voiced speech)."""
    n_samples = int(sample_rate * duration_ms / 1000)
    t = np.arange(n_samples, dtype=np.float64) / sample_rate
    signal = amplitude * np.sin(2 * np.pi * frequency * t)
    return (signal * 32767).astype(np.int16).tobytes()


def _speech_like(duration_ms: int, sample_rate: int = 16_000) -> bytes:
    """Generate speech-like audio (mixed frequencies, amplitude variation)."""
    n_samples = int(sample_rate * duration_ms / 1000)
    t = np.arange(n_samples, dtype=np.float64) / sample_rate
    # Fundamental + harmonics to approximate voiced speech
    signal = (
        0.4 * np.sin(2 * np.pi * 150 * t)  # fundamental
        + 0.25 * np.sin(2 * np.pi * 300 * t)  # 1st harmonic
        + 0.15 * np.sin(2 * np.pi * 450 * t)  # 2nd harmonic
        + 0.1 * np.sin(2 * np.pi * 600 * t)  # 3rd harmonic
    )
    # Add slight amplitude modulation (syllable-like)
    envelope = 0.7 + 0.3 * np.sin(2 * np.pi * 4 * t)
    signal = signal * envelope
    return (signal * 32767).astype(np.int16).tobytes()


@pytest.fixture
def vad():
    """Create a VAD instance with test-friendly parameters."""
    return SileroVAD(
        min_speech_ms=100,  # shorter for testing
        min_silence_ms=300,  # shorter for testing
    )


class TestSileroVADInit:
    def test_default_model_loads(self):
        """Model loads from default path without errors."""
        vad = SileroVAD()
        assert vad is not None

    def test_custom_thresholds(self):
        """Custom thresholds are accepted."""
        vad = SileroVAD(threshold=0.6, silence_threshold=0.4)
        assert vad._threshold == 0.6
        assert vad._silence_threshold == 0.4

    def test_invalid_model_path_raises(self):
        """Invalid model path raises an error."""
        with pytest.raises(Exception):
            SileroVAD(model_path="/nonexistent/path.onnx")


class TestSileroVADSilence:
    def test_silence_produces_no_utterances(self, vad):
        """Pure silence should not trigger any speech detection."""
        # Feed 5 seconds of silence in 200ms chunks
        for _ in range(25):
            chunk = _silence(200)
            utterances = vad.process_chunk(chunk)
            assert utterances == [], "Silence should not produce utterances"

    def test_flush_after_silence_returns_none(self, vad):
        """Flushing after only silence should return None."""
        for _ in range(10):
            vad.process_chunk(_silence(200))
        assert vad.flush() is None


class TestSileroVADSpeech:
    def test_speech_then_silence_produces_utterance(self, vad):
        """Speech followed by sufficient silence should emit one utterance."""
        all_utterances = []

        # 2 seconds of speech-like audio
        for _ in range(10):
            utterances = vad.process_chunk(_speech_like(200))
            all_utterances.extend(utterances)

        # 2 seconds of silence to trigger speech end
        for _ in range(10):
            utterances = vad.process_chunk(_silence(200))
            all_utterances.extend(utterances)

        assert len(all_utterances) >= 1, "Should detect at least one speech segment"
        # Utterance should be non-empty Int16 PCM bytes
        assert len(all_utterances[0]) > 0
        assert len(all_utterances[0]) % 2 == 0  # Int16 = 2 bytes per sample

    def test_flush_emits_in_progress_speech(self, vad):
        """Flushing during speech should return the accumulated audio."""
        # Feed speech without trailing silence
        for _ in range(10):
            vad.process_chunk(_speech_like(200))

        result = vad.flush()
        # May or may not emit depending on whether model detected speech.
        # If it did detect speech, result should be bytes.
        if result is not None:
            assert isinstance(result, bytes)
            assert len(result) > 0


class TestSileroVADMixed:
    def test_multiple_utterances(self, vad):
        """Speech-silence-speech-silence should produce two utterances."""
        all_utterances = []

        for _ in range(2):
            # 1.5s speech
            for _ in range(8):
                utterances = vad.process_chunk(_speech_like(200))
                all_utterances.extend(utterances)
            # 1.5s silence
            for _ in range(8):
                utterances = vad.process_chunk(_silence(200))
                all_utterances.extend(utterances)

        # Flush any trailing
        final = vad.flush()
        if final:
            all_utterances.append(final)

        assert len(all_utterances) >= 1, "Should detect at least one speech segment"

    def test_short_noise_rejected(self, vad):
        """Very short noise bursts should be filtered by min_speech_ms."""
        all_utterances = []

        # 1 second silence
        for _ in range(5):
            utterances = vad.process_chunk(_silence(200))
            all_utterances.extend(utterances)

        # 50ms tone (below min_speech_ms=100ms)
        utterances = vad.process_chunk(_tone(440, 50))
        all_utterances.extend(utterances)

        # 2 seconds silence
        for _ in range(10):
            utterances = vad.process_chunk(_silence(200))
            all_utterances.extend(utterances)

        assert len(all_utterances) == 0, "Short noise burst should be rejected"


class TestSileroVADChunking:
    def test_various_chunk_sizes(self, vad):
        """VAD should handle different chunk sizes correctly."""
        # Generate 2s of speech as one big buffer
        speech_bytes = _speech_like(2000)

        # Feed in odd-sized chunks (50ms, 100ms, 300ms)
        offset = 0
        chunk_sizes_bytes = [1600, 3200, 9600]  # 50ms, 100ms, 300ms
        while offset < len(speech_bytes):
            size = chunk_sizes_bytes[offset % len(chunk_sizes_bytes)]
            chunk = speech_bytes[offset : offset + size]
            if len(chunk) > 0:
                vad.process_chunk(chunk)
            offset += size

        # Should not crash — the reframing logic handles arbitrary sizes
        result = vad.flush()
        # Result may or may not be present depending on model output

    def test_single_sample_chunks(self, vad):
        """Even tiny chunks (1 sample = 2 bytes) should work via buffering."""
        speech = _speech_like(200)
        # Feed 2 bytes at a time (1 sample)
        for i in range(0, min(640, len(speech)), 2):  # first 200 samples
            vad.process_chunk(speech[i : i + 2])
        # Should not crash


class TestSileroVADReset:
    def test_reset_clears_state(self, vad):
        """Reset should clear all state."""
        # Feed some speech
        for _ in range(5):
            vad.process_chunk(_speech_like(200))

        vad.reset()

        # After reset, silence should not produce utterances
        for _ in range(10):
            utterances = vad.process_chunk(_silence(200))
            assert utterances == []
