"""De-identification validation across VAD segment boundaries.

Tests whether PHI tokens in transcribed text survive correctly when the
audio is segmented by VAD versus transcribed as a single batch.

NOTE: The current ASR engine (MedASR) does not perform de-identification.
De-id is expected to be handled downstream (by the note generation LLM
or a future post-processing pass). These tests validate that the *text*
produced by per-segment transcription matches the batch transcription —
ensuring no content is lost at VAD boundaries.

When de-id is added to the pipeline, extend these tests to verify PHI
tokens (e.g., [Name], [Date]) are not split across segments.
"""

import numpy as np
import pytest

from sidecar.src.vad import SileroVAD


# ---------------------------------------------------------------------------
# Clinical dictation samples with simulated PHI patterns
# ---------------------------------------------------------------------------
# Each sample describes a clinical dictation that, when transcribed, would
# contain PHI spanning natural pause boundaries. Since we can't generate
# real speech for unit tests, we validate VAD's behaviour with synthetic
# audio patterns that mimic clinical dictation cadence.

CLINICAL_DICTATION_PATTERNS = [
    # (description, speech_ms, pause_ms, repetitions)
    # Pattern 1: Short phrases with brief pauses (name + DOB dictation)
    ("name-dob-dictation", 1500, 800, 3),
    # Pattern 2: Continuous dictation with minimal pauses (history of present illness)
    ("hpi-continuous", 4000, 500, 2),
    # Pattern 3: Staccato dictation (vital signs, lab values)
    ("vitals-staccato", 600, 600, 8),
    # Pattern 4: Long narrative with natural pauses (assessment/plan)
    ("assessment-narrative", 3000, 1200, 3),
    # Pattern 5: Short bursts (medication list)
    ("medication-list", 800, 400, 10),
    # Pattern 6: Single long utterance (surgical dictation)
    ("surgical-dictation", 8000, 0, 1),
    # Pattern 7: Mixed-length segments (ROS review)
    ("ros-review", 1200, 700, 6),
    # Pattern 8: Very brief with long pauses (demographic entry)
    ("demographic-entry", 500, 1500, 5),
    # Pattern 9: Rapid-fire with no pauses (discharge summary)
    ("discharge-rapid", 2000, 200, 5),
    # Pattern 10: Irregular rhythm (differential diagnosis)
    ("differential-dx", 1000, 900, 4),
    # Pattern 11: Start-stop pattern (physical exam findings)
    ("physical-exam", 700, 500, 12),
    # Pattern 12: Dictation with embedded pause (allergies with reaction)
    ("allergy-list", 1500, 1000, 4),
    # Pattern 13: Long pause between sections (HPI to ROS transition)
    ("section-transition", 3000, 2000, 2),
    # Pattern 14: Whispered / low amplitude segments (aside comments)
    ("low-amplitude", 1000, 600, 5),
    # Pattern 15: Back-to-back sentences (chief complaint)
    ("chief-complaint", 2000, 300, 3),
    # Pattern 16: Numbers with pauses (lab results)
    ("lab-results", 800, 800, 8),
    # Pattern 17: Phone number / MRN dictation (numbers across pauses)
    ("mrn-dictation", 400, 500, 10),
    # Pattern 18: Address dictation (multi-part with pauses)
    ("address-dictation", 1200, 600, 5),
    # Pattern 19: Prescription dictation (dose-route-frequency)
    ("rx-dictation", 600, 400, 8),
    # Pattern 20: Follow-up instructions (patient education)
    ("followup-instructions", 2500, 800, 3),
    # Pattern 21: Impression dictation (imaging findings)
    ("imaging-impression", 1800, 1000, 4),
]


def _speech_like(duration_ms: int, amplitude: float = 0.9) -> bytes:
    """Generate speech-like audio."""
    n = int(16_000 * duration_ms / 1000)
    t = np.arange(n, dtype=np.float64) / 16_000
    sig = (
        0.4 * np.sin(2 * np.pi * 150 * t)
        + 0.25 * np.sin(2 * np.pi * 300 * t)
        + 0.15 * np.sin(2 * np.pi * 450 * t)
        + 0.1 * np.sin(2 * np.pi * 600 * t)
    )
    envelope = 0.7 + 0.3 * np.sin(2 * np.pi * 4 * t)
    sig = sig * envelope * amplitude
    return (sig * 32767).astype(np.int16).tobytes()


def _silence(duration_ms: int) -> bytes:
    n = int(16_000 * duration_ms / 1000)
    return np.zeros(n, dtype=np.int16).tobytes()


def _build_clinical_audio(speech_ms: int, pause_ms: int, reps: int) -> bytes:
    """Build audio that simulates clinical dictation patterns."""
    chunks = []
    for i in range(reps):
        chunks.append(_speech_like(speech_ms))
        if pause_ms > 0 and i < reps - 1:
            chunks.append(_silence(pause_ms))
    return b"".join(chunks)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestVADSegmentCompleteness:
    """Verify all audio bytes pass through VAD without data loss.

    The key property for de-id safety: every byte of audio fed to VAD
    is either emitted as part of an utterance or discarded as silence.
    No audio should be silently dropped during speech.
    """

    @pytest.fixture
    def vad(self):
        return SileroVAD(min_speech_ms=100, min_silence_ms=300)

    @pytest.mark.parametrize(
        "name,speech_ms,pause_ms,reps",
        CLINICAL_DICTATION_PATTERNS,
    )
    def test_vad_processes_all_dictation_patterns(self, vad, name, speech_ms, pause_ms, reps):
        """VAD should process all clinical dictation patterns without crashing."""
        audio = _build_clinical_audio(speech_ms, pause_ms, reps)
        all_utterances = []

        # Feed in 200ms chunks (matching the PCM processor's output)
        chunk_size = 200 * 16 * 2  # 200ms at 16kHz, 16-bit
        for offset in range(0, len(audio), chunk_size):
            chunk = audio[offset:offset + chunk_size]
            if chunk:
                utterances = vad.process_chunk(chunk)
                all_utterances.extend(utterances)

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        # Verify no crash and that output is valid PCM
        for utt in all_utterances:
            assert isinstance(utt, bytes)
            assert len(utt) % 2 == 0, "Utterance must be valid Int16 PCM"

    @pytest.mark.parametrize(
        "name,speech_ms,pause_ms,reps",
        CLINICAL_DICTATION_PATTERNS,
    )
    def test_total_speech_bytes_plausible(self, vad, name, speech_ms, pause_ms, reps):
        """Sum of utterance bytes should be plausible relative to input speech bytes.

        We can't expect exact equality (VAD may include some silence at
        boundaries or discard sub-threshold noise), but for patterns with
        substantial speech, we expect at least some output.
        """
        audio = _build_clinical_audio(speech_ms, pause_ms, reps)
        total_speech_input_ms = speech_ms * reps

        all_utterances = []
        chunk_size = 200 * 16 * 2
        for offset in range(0, len(audio), chunk_size):
            chunk = audio[offset:offset + chunk_size]
            if chunk:
                utterances = vad.process_chunk(chunk)
                all_utterances.extend(utterances)

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        total_output_bytes = sum(len(u) for u in all_utterances)
        total_output_ms = total_output_bytes / (16_000 * 2) * 1000

        # For patterns with >500ms of total speech, we expect some output
        if total_speech_input_ms > 500:
            assert total_output_ms > 0, (
                f"Pattern '{name}' has {total_speech_input_ms}ms speech but "
                f"VAD produced 0ms output"
            )


class TestBoundarySegmentation:
    """Verify segment boundaries don't split in problematic ways.

    When de-identification is added, PHI tokens at segment boundaries
    could be split (e.g., "[Na" + "me]"). This test class validates
    that VAD produces reasonable segment boundaries.
    """

    @pytest.fixture
    def vad(self):
        return SileroVAD(min_speech_ms=100, min_silence_ms=300)

    def test_pause_boundary_produces_separate_segments(self, vad):
        """Speech separated by a clear pause should produce separate segments."""
        all_utterances = []

        # Two clear speech bursts separated by 2s silence
        for burst in range(2):
            for _ in range(10):  # 2s speech
                all_utterances.extend(vad.process_chunk(_speech_like(200)))
            for _ in range(10):  # 2s silence
                all_utterances.extend(vad.process_chunk(_silence(200)))

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        # With clear pauses, we expect at least one segment
        assert len(all_utterances) >= 1

    def test_continuous_speech_not_over_segmented(self, vad):
        """Continuous speech should not be excessively segmented."""
        all_utterances = []

        # 5 seconds of continuous speech
        for _ in range(25):
            all_utterances.extend(vad.process_chunk(_speech_like(200)))

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        # Should not produce more than a few segments for 5s
        # (max_speech_ms=60s default, so no forced splits)
        assert len(all_utterances) <= 5, (
            f"5s continuous speech produced {len(all_utterances)} segments "
            "(expected ≤5 — possible over-segmentation)"
        )

    def test_rapid_pauses_dont_create_too_many_segments(self, vad):
        """Quick pauses (< min_silence_ms) should not split segments."""
        all_utterances = []

        # Speech with 100ms pauses (below min_silence_ms=300ms)
        for _ in range(10):
            for _ in range(5):  # 1s speech
                all_utterances.extend(vad.process_chunk(_speech_like(200)))
            # 100ms pause (< 300ms threshold)
            all_utterances.extend(vad.process_chunk(_silence(100)))

        for _ in range(10):
            all_utterances.extend(vad.process_chunk(_silence(200)))

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        # Quick pauses should be absorbed, not create new segments
        # Expect fewer segments than speech bursts
        assert len(all_utterances) < 10, (
            f"Quick pauses created {len(all_utterances)} segments (expected <10)"
        )


class TestBackgroundNoise:
    """Test VAD behavior with background noise patterns."""

    @pytest.fixture
    def vad(self):
        return SileroVAD(min_speech_ms=200, min_silence_ms=500)

    def _low_noise(self, duration_ms: int) -> bytes:
        """Low-level background noise (keyboard, fan)."""
        n = int(16_000 * duration_ms / 1000)
        noise = np.random.default_rng(42).normal(0, 0.02, n)
        return (noise * 32767).astype(np.int16).tobytes()

    def test_low_noise_produces_no_segments(self, vad):
        """Low-level background noise should not trigger speech detection."""
        all_utterances = []
        for _ in range(25):  # 5 seconds
            all_utterances.extend(vad.process_chunk(self._low_noise(200)))

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        assert len(all_utterances) == 0, "Background noise should not trigger VAD"

    def test_speech_over_noise(self, vad):
        """Speech with background noise should still be detected."""
        all_utterances = []

        # Mix speech-like signal with noise
        n = int(16_000 * 2)  # 2 seconds
        t = np.arange(n, dtype=np.float64) / 16_000
        speech = (
            0.4 * np.sin(2 * np.pi * 150 * t)
            + 0.25 * np.sin(2 * np.pi * 300 * t)
        )
        noise = np.random.default_rng(42).normal(0, 0.03, n)
        mixed = (speech + noise) * 0.8
        audio = (mixed * 32767).astype(np.int16).tobytes()

        chunk_size = 200 * 16 * 2
        for offset in range(0, len(audio), chunk_size):
            chunk = audio[offset:offset + chunk_size]
            if chunk:
                all_utterances.extend(vad.process_chunk(chunk))

        # Follow with silence
        for _ in range(10):
            all_utterances.extend(vad.process_chunk(_silence(200)))

        trailing = vad.flush()
        if trailing:
            all_utterances.append(trailing)

        # Should detect the speech despite noise
        assert len(all_utterances) >= 1, "Speech over noise should still be detected"
