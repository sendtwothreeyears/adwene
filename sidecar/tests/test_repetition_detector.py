"""Tests for the repetition detector module."""

import pytest

from sidecar.src.repetition_detector import RepetitionDetector


class TestNoRepetition:
    """Normal clinical text should NOT trigger the detector."""

    def test_normal_soap_note(self):
        text = (
            "# Subjective\n"
            "Patient is a 45-year-old male presenting with chest pain for 2 hours. "
            "Pain is sharp, located in the left chest, radiating to the left arm. "
            "Patient denies shortness of breath, nausea, or diaphoresis.\n\n"
            "# Objective\n"
            "Vital signs: BP 130/85, HR 88, RR 18, Temp 98.6F, SpO2 98%. "
            "Heart sounds regular, no murmurs. Lungs clear bilaterally.\n\n"
            "# Assessment\n"
            "Chest pain, likely musculoskeletal. Rule out acute coronary syndrome.\n\n"
            "# Plan\n"
            "EKG and troponin. If negative, discharge with follow-up in 48 hours."
        )
        detector = RepetitionDetector()
        detector.feed(text)
        assert not detector.is_looping

    def test_legitimate_repeated_terms(self):
        """Medical terms like 'hypertension' can appear multiple times."""
        text = (
            "Patient has a history of hypertension. "
            "Hypertension is well-controlled on current medications. "
            "Assessment: Hypertension controlled on lisinopril 10mg daily. "
            "Plan: Continue current hypertension management."
        )
        detector = RepetitionDetector()
        detector.feed(text)
        assert not detector.is_looping

    def test_short_text(self):
        detector = RepetitionDetector()
        detector.feed("Hello world.")
        assert not detector.is_looping

    def test_empty_text(self):
        detector = RepetitionDetector()
        detector.feed("")
        assert not detector.is_looping

    def test_natural_repeated_actions_not_flagged(self):
        """Patient literally repeated actions — the model should document this faithfully."""
        text = (
            "Patient is a 25-year-old male presenting with severe chest pain. "
            "Patient reports a three-day binge of cocaine and alcohol use while in Atlantic City. "
            "He woke up with severe dyspnea and tachycardia, felt very anxious, "
            "and decided to smoke marijuana, which did not help. "
            "He then took another puff of marijuana again, which did not help. "
            "He called an ambulance because his heart was racing and the pain got worse. "
            "While in the ambulance, he took another puff of marijuana again, which did not help. "
            "On arrival: tachycardic HR 130s, BP 120/80. "
            "Labs unremarkable. Urine tox positive for benzodiazepines, opioids. Ethanol level 100. "
            "CT scan revealed a small apical pneumothorax."
        )
        detector = RepetitionDetector()
        detector.feed(text)
        assert not detector.is_looping


class TestRepetitionDetection:
    """Obvious repetition loops SHOULD trigger the detector."""

    def test_exact_phrase_repeated(self):
        phrase = "Patient symptoms were not discussed at all. "
        text = phrase * 10
        detector = RepetitionDetector()
        detector.feed(text)
        assert detector.is_looping

    def test_multi_word_loop(self):
        phrase = "The patient was examined and findings were normal. "
        text = "Initial assessment complete. " + phrase * 6
        detector = RepetitionDetector()
        detector.feed(text)
        assert detector.is_looping

    def test_streamed_chunks_detect_loop(self):
        """Feeding text in small chunks should still detect loops."""
        good = "Patient presents with headache. History reviewed. "
        bad_phrase = "Not documented in the encounter today. "

        detector = RepetitionDetector()
        # Feed good text first
        for word in good.split():
            detector.feed(word + " ")
        assert not detector.is_looping

        # Now feed the repeating phrase chunk by chunk
        for _ in range(6):
            for word in bad_phrase.split():
                detector.feed(word + " ")
                if detector.is_looping:
                    break
            if detector.is_looping:
                break

        assert detector.is_looping

    def test_not_discussed_loop(self):
        """The exact pattern reported by the user — 5-gram repeated 4+ times."""
        text = (
            "# Subjective\n"
            "Patient is a 30-year-old female.\n\n"
            "# Review of Systems\n"
            "patient symptoms were not discussed, "
            "patient symptoms were not discussed, "
            "patient symptoms were not discussed, "
            "patient symptoms were not discussed, "
            "patient symptoms were not discussed, "
        )
        detector = RepetitionDetector()
        detector.feed(text)
        assert detector.is_looping


class TestCleanText:
    """clean_text should return text truncated at a sentence boundary."""

    def test_truncates_before_repetition(self):
        good = "Patient has headache. History of migraines. Current medications reviewed."
        bad = (" Not discussed at this time today."
               " Not discussed at this time today."
               " Not discussed at this time today."
               " Not discussed at this time today."
               " Not discussed at this time today.")
        detector = RepetitionDetector()
        detector.feed(good + bad)
        assert detector.is_looping

        clean = detector.clean_text
        # Should be significantly shorter than the full text
        assert len(clean) < len(good + bad)
        # Should end at a sentence boundary
        assert clean.rstrip().endswith(".")
        # Should contain the good text
        assert "Patient has headache" in clean

    def test_clean_text_when_not_looping(self):
        detector = RepetitionDetector()
        detector.feed("Normal text here.")
        assert detector.clean_text == "Normal text here."

    def test_medical_abbreviations_preserved(self):
        """pySBD should handle Dr., mg., etc. without false sentence splits."""
        good = "Dr. Smith prescribed 500 mg. of amoxicillin. Patient tolerated well."
        bad = (" Not documented in the encounter."
               " Not documented in the encounter."
               " Not documented in the encounter."
               " Not documented in the encounter."
               " Not documented in the encounter.")
        detector = RepetitionDetector()
        detector.feed(good + bad)
        assert detector.is_looping

        clean = detector.clean_text
        # Should preserve Dr. and mg. intact
        assert "Dr." in clean or "Patient tolerated well" in clean


class TestConfiguration:
    """Custom thresholds should work."""

    def test_higher_threshold_avoids_trigger(self):
        phrase = "Patient symptoms were not discussed. "
        text = phrase * 4  # exactly 4 occurrences — matches default threshold
        # Default threshold is 4 — should trigger
        d1 = RepetitionDetector()
        d1.feed(text)
        assert d1.is_looping

        # Higher threshold — should NOT trigger
        d2 = RepetitionDetector(max_occurrences=6)
        d2.feed(text)
        assert not d2.is_looping

    def test_smaller_window(self):
        """A very small window should still detect nearby repetitions."""
        phrase = "Same exact phrase repeated here. "
        text = phrase * 5
        detector = RepetitionDetector(window_words=50)
        detector.feed(text)
        assert detector.is_looping
