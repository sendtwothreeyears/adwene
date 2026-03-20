"""Tests for shared prompts."""

from sidecar.src.prompts import SYSTEM_PROMPT


class TestSystemPromptEntityTagging:
    """Verify the system prompt includes entity tagging instructions."""

    def test_contains_drug_tag_syntax(self):
        assert "{{drug:" in SYSTEM_PROMPT

    def test_contains_condition_tag_syntax(self):
        assert "{{condition:" in SYSTEM_PROMPT

    def test_instructs_first_occurrence_only(self):
        assert "first occurrence" in SYSTEM_PROMPT.lower() or "FIRST occurrence" in SYSTEM_PROMPT

    def test_excludes_symptoms_procedures_labs(self):
        assert "Do NOT tag symptoms, procedures, lab tests" in SYSTEM_PROMPT

    def test_drug_example_present(self):
        assert "{{drug:metformin}}" in SYSTEM_PROMPT

    def test_condition_example_present(self):
        assert "{{condition:type 2 diabetes mellitus}}" in SYSTEM_PROMPT
