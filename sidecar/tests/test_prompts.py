"""Tests for shared prompts."""

from sidecar.src.prompts import SYSTEM_PROMPT


class TestSystemPromptStructure:
    """Verify the system prompt meets the design contract."""

    def test_prompt_under_token_budget(self):
        """Prompt should be ~150 tokens; enforce a generous 200-word ceiling."""
        assert len(SYSTEM_PROMPT.split()) <= 200

    def test_contains_role_identity(self):
        assert "clinical documentation assistant" in SYSTEM_PROMPT

    def test_contains_heading_formatting_instruction(self):
        assert "markdown headings" in SYSTEM_PROMPT.lower() or "# " in SYSTEM_PROMPT

    def test_no_format_specific_bias(self):
        """Prompt should not contain SOAP-specific section names that bias output."""
        assert "# Subjective" not in SYSTEM_PROMPT
        assert "# Objective" not in SYSTEM_PROMPT
        assert "# Assessment" not in SYSTEM_PROMPT

    def test_no_entity_tagging_instructions(self):
        assert "{{drug:" not in SYSTEM_PROMPT
        assert "{{condition:" not in SYSTEM_PROMPT

    def test_transcript_fidelity_instruction(self):
        assert "transcript" in SYSTEM_PROMPT.lower()

    def test_positive_phrasing(self):
        """Prompt should use positive-only phrasing (no 'Do not' / 'Never')."""
        assert "Do not" not in SYSTEM_PROMPT
        assert "Never" not in SYSTEM_PROMPT
