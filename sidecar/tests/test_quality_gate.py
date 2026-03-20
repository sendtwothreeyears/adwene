"""Tests for the transcript quality gate (KAS-280)."""

import time

from sidecar.src.quality_gate import GateResult, select_transcript, _word_edit_distance


class TestWordEditDistance:
    """Test the word-level edit distance function."""

    def test_identical(self):
        assert _word_edit_distance(["a", "b", "c"], ["a", "b", "c"]) == 0

    def test_one_insertion(self):
        assert _word_edit_distance(["a", "b"], ["a", "b", "c"]) == 1

    def test_one_deletion(self):
        assert _word_edit_distance(["a", "b", "c"], ["a", "c"]) == 1

    def test_one_substitution(self):
        assert _word_edit_distance(["a", "b", "c"], ["a", "x", "c"]) == 1

    def test_empty_to_full(self):
        assert _word_edit_distance([], ["a", "b"]) == 2

    def test_full_to_empty(self):
        assert _word_edit_distance(["a", "b"], []) == 2

    def test_both_empty(self):
        assert _word_edit_distance([], []) == 0


class TestSelectTranscript:
    """Test the quality gate transcript selection."""

    def test_agree_selects_full_audio(self):
        """When transcripts are nearly identical, full_audio wins."""
        result = select_transcript(
            "the patient has a fever",
            "the patient has a fever",
        )
        assert result.selected == "full_audio"
        assert result.reason == "agree"
        assert result.edit_ratio == 0.0

    def test_minor_difference_agrees(self):
        """<5% word edit distance counts as agreement."""
        # 1 word substitution out of 30 words = ~3.3%
        seg = "the patient presented with a fever and cough and reported feeling unwell for three days prior to the visit the temperature was measured at ninety nine point five degrees fahrenheit at the time of examination"
        full = "the patient presented with a fever and cough and reported feeling unwell for three days prior to the visit the temperature was measured at ninety nine point five degrees Fahrenheit at the time of examination"
        result = select_transcript(seg, full)
        assert result.selected == "full_audio"
        assert result.reason == "agree"

    def test_significant_difference_selects_full_audio(self):
        """When transcripts differ significantly, full_audio still wins (more LM context)."""
        result = select_transcript(
            "the patient has a fever",
            "the patient has a high grade fever and cough",
        )
        assert result.selected == "full_audio"
        assert result.reason == "full_audio_wins"
        assert result.edit_ratio > 0.05

    def test_empty_full_audio_falls_back_to_segments(self):
        """Safety valve: empty full-audio falls back to segments."""
        result = select_transcript("the patient has a fever", "")
        assert result.selected == "segments"
        assert result.reason == "safety_valve:empty_full_audio"

    def test_drastically_shorter_full_audio_falls_back(self):
        """Safety valve: full-audio <50% of segment length falls back."""
        result = select_transcript(
            "the patient presented with fever cough and body aches for three days",
            "the patient",
        )
        assert result.selected == "segments"
        assert result.reason == "safety_valve:full_audio_too_short"

    def test_empty_both_returns_full_audio(self):
        """Both empty — full_audio wins (agree fast-path, ratio=0)."""
        result = select_transcript("", "")
        assert result.selected == "full_audio"
        assert result.reason == "agree"

    def test_returns_gate_result(self):
        """Should return a proper GateResult dataclass."""
        result = select_transcript("hello", "hello world")
        assert isinstance(result, GateResult)
        assert isinstance(result.edit_ratio, float)

    def test_performance_under_10ms(self):
        """Quality gate should complete in under 10ms for realistic transcripts."""
        # ~500 words — typical 10-minute consultation.
        # Uses fast bag-of-words path for >200 words.
        seg = " ".join(["word"] * 500)
        full = " ".join(["word"] * 498 + ["changed", "text"])

        # Warm up
        select_transcript(seg, full)

        t0 = time.perf_counter()
        for _ in range(100):
            select_transcript(seg, full)
        elapsed = (time.perf_counter() - t0) / 100

        assert elapsed < 0.010, f"Quality gate took {elapsed*1000:.1f}ms (>10ms)"
