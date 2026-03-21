"""Tests for template-driven prompt construction.

Verifies that build_note_prompt produces correct prompts for different
template types, ensuring strict template adherence and proper structure.
"""

from sidecar.src.prompts import (
    build_note_prompt,
    count_sections,
    estimate_max_tokens,
)


SOAP_TEMPLATE = """\
## Subjective
## Objective
## Assessment
## Plan"""

HP_TEMPLATE = """\
## Patient Information
## History of Present Illness
## Past Medical History
## Physical Examination
## Assessment and Plan"""

SINGLE_SECTION_TEMPLATE = """\
## Chief Complaint
[Only list the chief complaint]"""


class TestCountSections:
    def test_counts_h2_headings(self):
        assert count_sections(SOAP_TEMPLATE) == 4

    def test_counts_h1_headings(self):
        assert count_sections("# Section One\n# Section Two") == 2

    def test_mixed_headings(self):
        assert count_sections("# Top\n## Sub1\n## Sub2") == 3

    def test_no_headings_returns_zero(self):
        assert count_sections("Just plain text") == 0

    def test_single_section(self):
        assert count_sections(SINGLE_SECTION_TEMPLATE) == 1

    def test_empty_string(self):
        assert count_sections("") == 0


class TestEstimateMaxTokens:
    def test_single_section_gets_minimum(self):
        assert estimate_max_tokens(SINGLE_SECTION_TEMPLATE) == 400

    def test_four_sections(self):
        assert estimate_max_tokens(SOAP_TEMPLATE) == 1400

    def test_no_sections_returns_default(self):
        assert estimate_max_tokens("plain text") == 1500

    def test_large_template_capped(self):
        big = "\n".join(f"## Section {i}" for i in range(20))
        assert estimate_max_tokens(big) == 2000


class TestBuildNotePrompt:
    """Verify the assembled prompt has the right structure."""

    def test_is_single_string(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "Patient has chest pain")
        assert isinstance(prompt, str)

    def test_contains_instructions(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript text")
        assert "<instructions>" in prompt
        assert "</instructions>" in prompt

    def test_contains_example(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript text")
        assert "<example>" in prompt
        assert "</example>" in prompt

    def test_contains_template_block(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript text")
        assert "<template>" in prompt
        assert "</template>" in prompt
        assert "Subjective" in prompt

    def test_contains_transcript_block(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "Patient has chest pain")
        assert "<transcript>" in prompt
        assert "Patient has chest pain" in prompt

    def test_section_count_anchor_for_soap(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript")
        assert "exactly 4 section(s)" in prompt

    def test_section_count_anchor_for_single(self):
        prompt = build_note_prompt(SINGLE_SECTION_TEMPLATE, "transcript")
        assert "exactly 1 section(s)" in prompt

    def test_hp_template_includes_hp_sections(self):
        prompt = build_note_prompt(HP_TEMPLATE, "transcript")
        assert "Patient Information" in prompt
        assert "Assessment and Plan" in prompt

    def test_hp_does_not_add_soap_bias(self):
        prompt = build_note_prompt(HP_TEMPLATE, "transcript")
        # Only the example block has "Chief Complaint" and "Assessment" —
        # the instructions block should not have SOAP section names
        instructions_end = prompt.index("</instructions>")
        instructions = prompt[:instructions_end]
        assert "Subjective" not in instructions
        assert "Objective" not in instructions

    def test_template_before_transcript(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "the transcript text")
        template_pos = prompt.index("<template>")
        transcript_pos = prompt.index("<transcript>")
        assert template_pos < transcript_pos

    def test_context_included_when_provided(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript", context="Patient has diabetes")
        assert "<context>" in prompt
        assert "Patient has diabetes" in prompt

    def test_context_omitted_when_empty(self):
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript", context="")
        assert "<context>" not in prompt

    def test_no_template_omits_template_block(self):
        prompt = build_note_prompt("", "transcript")
        assert "</template>" not in prompt

    def test_no_system_role_markers(self):
        """The prompt should not contain system-role artifacts."""
        prompt = build_note_prompt(SOAP_TEMPLATE, "transcript")
        assert "system" not in prompt.lower().split("<")[0]  # no "system:" prefix
