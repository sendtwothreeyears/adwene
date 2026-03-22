"""Tests for shared prompts module.

Covers:
- SYSTEM_INSTRUCTIONS constant (training-format instructions)
- build_note_prompt() (training-format and legacy toggle)
- strip_model_artifacts() (unchanged)
- TITLE_PROMPT (unchanged)
- Golden-prompt test against training data
"""

import json
import os
from pathlib import Path

import pytest

from sidecar.src import config
from sidecar.src.prompts import (
    CLOSING_DIRECTIVE,
    SYSTEM_INSTRUCTIONS,
    TITLE_PROMPT,
    build_note_prompt,
    strip_model_artifacts,
)

# ---------------------------------------------------------------------------
# Fixtures / constants
# ---------------------------------------------------------------------------

SOAP_TEMPLATE = """\
# Subjective
## History of Present Illness
## Review of Systems

# Objective
## Vital Signs
## Physical Examination

# Assessment

# Plan"""

SIMPLE_TRANSCRIPT = "Doctor: What brings you in today?\nPatient: I have a headache."

TRAIN_JSONL = Path(__file__).resolve().parents[2] / "fine-tuning" / "data" / "formatted" / "train.jsonl"


# ---------------------------------------------------------------------------
# SYSTEM_INSTRUCTIONS
# ---------------------------------------------------------------------------

class TestSystemInstructions:
    """Verify the system instructions constant matches the training format."""

    def test_has_opening_delimiter(self):
        assert "[SYSTEM INSTRUCTIONS]" in SYSTEM_INSTRUCTIONS

    def test_has_closing_delimiter(self):
        assert "[END SYSTEM INSTRUCTIONS]" in SYSTEM_INSTRUCTIONS

    def test_contains_role_identity(self):
        assert "medical documentation assistant" in SYSTEM_INSTRUCTIONS

    # -- All 12 critical rules present --

    def test_rule_1_use_only_transcription_info(self):
        assert "Use ONLY information explicitly stated in the transcription" in SYSTEM_INSTRUCTIONS

    def test_rule_2_follow_template_exactly(self):
        assert "Follow the template structure EXACTLY as provided" in SYSTEM_INSTRUCTIONS

    def test_rule_3_document_negatives(self):
        assert 'do NOT write "Not documented"' in SYSTEM_INSTRUCTIONS

    def test_rule_4_not_documented_when_unmentioned(self):
        assert "truly never mentioned" in SYSTEM_INSTRUCTIONS

    def test_rule_5_parentheses_brackets_are_instructions(self):
        assert "ANY TEXT IN PARENTHESES () OR SQUARE BRACKETS []" in SYSTEM_INSTRUCTIONS

    def test_rule_6_review_of_systems(self):
        assert "Review of Systems" in SYSTEM_INSTRUCTIONS

    def test_rule_7_physical_examination(self):
        assert "Physical Examination" in SYSTEM_INSTRUCTIONS

    def test_rule_8_preserve_formatting(self):
        assert "Preserve exact template formatting" in SYSTEM_INSTRUCTIONS

    def test_rule_9_no_extrapolation(self):
        assert "Do NOT invent, assume, or extrapolate" in SYSTEM_INSTRUCTIONS

    def test_rule_10_professional_terminology(self):
        assert "professional medical terminology" in SYSTEM_INSTRUCTIONS

    def test_rule_11_no_preamble(self):
        assert "Return ONLY the completed note" in SYSTEM_INSTRUCTIONS

    def test_rule_12_strip_instructions(self):
        assert "STRIP OUT all parenthetical instructions" in SYSTEM_INSTRUCTIONS

    # -- Entity marking --

    def test_entity_marking_drug(self):
        assert "{{drug:" in SYSTEM_INSTRUCTIONS

    def test_entity_marking_condition(self):
        assert "{{condition:" in SYSTEM_INSTRUCTIONS

    def test_entity_marking_examples(self):
        assert "{{condition:type 2 diabetes}}" in SYSTEM_INSTRUCTIONS
        assert "{{drug:metformin}}" in SYSTEM_INSTRUCTIONS

    def test_entity_marking_first_occurrence_rule(self):
        assert "Only mark the FIRST occurrence" in SYSTEM_INSTRUCTIONS


# ---------------------------------------------------------------------------
# build_note_prompt — training format (default)
# ---------------------------------------------------------------------------

class TestBuildNotePrompt:
    """Verify training-format prompt structure."""

    def test_is_single_string(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert isinstance(prompt, str)

    def test_contains_system_instructions(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "[SYSTEM INSTRUCTIONS]" in prompt
        assert "[END SYSTEM INSTRUCTIONS]" in prompt

    def test_contains_template_label(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "TEMPLATE:" in prompt

    def test_contains_transcription_label(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "TRANSCRIPTION:" in prompt

    def test_contains_separator(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "\n---\n" in prompt

    def test_contains_closing_directive(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert CLOSING_DIRECTIVE in prompt

    def test_template_before_transcript(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert prompt.index("TEMPLATE:") < prompt.index("TRANSCRIPTION:")

    def test_template_content_present(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "# Subjective" in prompt
        assert "# Plan" in prompt

    def test_transcript_content_present(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "I have a headache" in prompt

    def test_context_prepended_to_transcription(self):
        prompt = build_note_prompt(
            SOAP_TEMPLATE, SIMPLE_TRANSCRIPT, context="Diabetic patient"
        )
        assert "[Patient context: Diabetic patient]" in prompt
        # Context should appear after TRANSCRIPTION: label
        trans_idx = prompt.index("TRANSCRIPTION:")
        ctx_idx = prompt.index("[Patient context:")
        assert ctx_idx > trans_idx

    def test_context_omitted_when_empty(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT, context="")
        assert "[Patient context:" not in prompt

    def test_no_xml_tags_in_training_format(self):
        """Training format should NOT use XML tags."""
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "<instructions>" not in prompt
        assert "<template>" not in prompt
        assert "<transcript>" not in prompt
        assert "<context>" not in prompt


# ---------------------------------------------------------------------------
# build_note_prompt — legacy toggle
# ---------------------------------------------------------------------------

class TestBuildNotePromptLegacy:
    """Verify PROMPT_FORMAT=legacy produces old XML format."""

    def setup_method(self):
        self._original = config.PROMPT_FORMAT
        config.PROMPT_FORMAT = "legacy"

    def teardown_method(self):
        config.PROMPT_FORMAT = self._original

    def test_legacy_uses_xml_instructions(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "<instructions>" in prompt
        assert "</instructions>" in prompt

    def test_legacy_uses_xml_template(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "<template>" in prompt
        assert "</template>" in prompt

    def test_legacy_uses_xml_transcript(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "<transcript>" in prompt
        assert "</transcript>" in prompt

    def test_legacy_context_uses_xml(self):
        prompt = build_note_prompt(
            SOAP_TEMPLATE, SIMPLE_TRANSCRIPT, context="Some context"
        )
        assert "<context>" in prompt
        assert "Some context" in prompt

    def test_legacy_no_training_delimiters(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, SIMPLE_TRANSCRIPT)
        assert "[SYSTEM INSTRUCTIONS]" not in prompt
        assert "TEMPLATE:" not in prompt


# ---------------------------------------------------------------------------
# Golden-prompt test — compare against real training data
# ---------------------------------------------------------------------------

class TestGoldenPrompt:
    """Verify build_note_prompt() output matches training data structure."""

    @pytest.fixture()
    def training_example(self):
        """Parse the first line of train.jsonl."""
        with open(TRAIN_JSONL) as f:
            return json.loads(f.readline())

    def test_structural_match(self, training_example):
        """Build a prompt from extracted template/transcript and verify
        all structural elements match the training data."""
        user_content = training_example["messages"][0]["content"]

        # Extract template from training data
        tmpl_start = user_content.index("TEMPLATE:\n") + len("TEMPLATE:\n")
        tmpl_end = user_content.index("\n\n---\n")
        template = user_content[tmpl_start:tmpl_end]

        # Extract transcript from training data
        trans_start = user_content.index("TRANSCRIPTION:\n") + len("TRANSCRIPTION:\n")
        closing_start = user_content.index("Generate a complete medical note")
        transcript = user_content[trans_start:closing_start].strip()

        # Build prompt using our function
        prompt = build_note_prompt(template, transcript)

        # Structural checks — same delimiters, labels, separators
        assert "[SYSTEM INSTRUCTIONS]" in prompt
        assert "[END SYSTEM INSTRUCTIONS]" in prompt
        assert "TEMPLATE:" in prompt
        assert "\n---\n" in prompt
        assert "TRANSCRIPTION:" in prompt
        assert "Generate a complete medical note" in prompt

        # Template and transcript content are preserved
        assert template in prompt
        assert transcript in prompt

    def test_system_instructions_match_training(self, training_example):
        """The SYSTEM_INSTRUCTIONS constant should appear verbatim in training data."""
        user_content = training_example["messages"][0]["content"]
        assert SYSTEM_INSTRUCTIONS in user_content

    def test_closing_directive_matches_training(self, training_example):
        """The closing directive should appear verbatim in training data."""
        user_content = training_example["messages"][0]["content"]
        assert CLOSING_DIRECTIVE in user_content


# ---------------------------------------------------------------------------
# strip_model_artifacts (unchanged)
# ---------------------------------------------------------------------------

class TestStripModelArtifacts:
    """Gemma control tokens should be stripped from output."""

    def test_clean_text_unchanged(self):
        text = "# Data\nPatient presents with chest pain."
        assert strip_model_artifacts(text) == text

    def test_strips_model_end_tag(self):
        text = "# Data\nPatient presents with chest pain.\n</model\ntime_elapsed\n150"
        assert strip_model_artifacts(text) == "# Data\nPatient presents with chest pain."

    def test_strips_unused_token(self):
        text = "# Plan\nContinue monitoring.\n<unused94>status\nComplete"
        assert strip_model_artifacts(text) == "# Plan\nContinue monitoring."

    def test_strips_thinking_after_note(self):
        note = "# Assessment\nAcute chest pain."
        thinking = "\n</model\n<unused94>thought\nThe user wants me to..."
        assert strip_model_artifacts(note + thinking) == "# Assessment\nAcute chest pain."

    def test_empty_string(self):
        assert strip_model_artifacts("") == ""

    def test_no_artifacts(self):
        text = "Normal clinical note with no special tokens."
        assert strip_model_artifacts(text) == text


# ---------------------------------------------------------------------------
# TITLE_PROMPT (unchanged)
# ---------------------------------------------------------------------------

class TestTitlePrompt:
    def test_title_prompt_exists(self):
        assert len(TITLE_PROMPT) > 0

    def test_title_prompt_word_limit(self):
        assert "4 to 5 words" in TITLE_PROMPT or "4-5 words" in TITLE_PROMPT
