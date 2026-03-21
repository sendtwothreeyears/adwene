"""Tests for shared prompts."""

from sidecar.src.prompts import INSTRUCTIONS, TITLE_PROMPT


class TestInstructionsStructure:
    """Verify the instructions block meets the design contract."""

    def test_instructions_under_token_budget(self):
        """Instructions should be concise; enforce a generous 200-word ceiling."""
        assert len(INSTRUCTIONS.split()) <= 200

    def test_contains_role_identity(self):
        assert "clinical documentation assistant" in INSTRUCTIONS

    def test_contains_heading_formatting_instruction(self):
        assert "markdown headings" in INSTRUCTIONS.lower() or "# " in INSTRUCTIONS

    def test_no_format_specific_bias(self):
        """Instructions should not contain SOAP-specific section names."""
        assert "Subjective" not in INSTRUCTIONS
        assert "Objective" not in INSTRUCTIONS

    def test_no_entity_tagging_instructions(self):
        assert "{{drug:" not in INSTRUCTIONS
        assert "{{condition:" not in INSTRUCTIONS

    def test_references_transcript(self):
        assert "transcript" in INSTRUCTIONS.lower()

    def test_uses_xml_tags(self):
        assert "<instructions>" in INSTRUCTIONS
        assert "</instructions>" in INSTRUCTIONS

    def test_references_template_block(self):
        assert "<template>" in INSTRUCTIONS


class TestTitlePrompt:
    def test_title_prompt_exists(self):
        assert len(TITLE_PROMPT) > 0

    def test_title_prompt_word_limit(self):
        assert "4 to 5 words" in TITLE_PROMPT or "4-5 words" in TITLE_PROMPT
