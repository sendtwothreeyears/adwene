"""Tests for template-driven prompt construction.

Verifies that the system prompt + template injection produces correct prompts
for different template types, ensuring no format-specific bias leaks through.
"""

from sidecar.src.prompts import SYSTEM_PROMPT


def _build_system_prompt(template: str = "", context: str = "") -> str:
    """Replicate the prompt construction logic from MedGemmaEngine."""
    system = SYSTEM_PROMPT
    if template:
        system += f"\n\nFormat the note using the following section structure:\n\n{template}"
    if context:
        system += f"\n\nAdditional context:\n{context}"
    return system


SOAP_TEMPLATE = (
    "Subjective\nChief Complaint\nHistory of Present Illness\n"
    "Objective\nPhysical Examination\nAssessment\nPlan"
)

HP_TEMPLATE = (
    "Patient Information\nHistory of Present Illness\n"
    "Past Medical History\nMedications\nAllergies\n"
    "Social History\nFamily History\nReview of Systems\n"
    "Physical Examination\nAssessment and Plan"
)

PROGRESS_NOTE_TEMPLATE = (
    "Progress Note\nSubjective\nObjective\n"
    "Assessment\nPlan"
)


class TestBasePromptNeutrality:
    """The base system prompt should not bias toward any specific note format."""

    def test_no_soap_sections(self):
        assert "Subjective" not in SYSTEM_PROMPT
        assert "Objective" not in SYSTEM_PROMPT
        assert "Assessment" not in SYSTEM_PROMPT

    def test_no_hp_sections(self):
        assert "Patient Information" not in SYSTEM_PROMPT
        assert "Assessment and Plan" not in SYSTEM_PROMPT

    def test_no_example_block(self):
        assert "Example:" not in SYSTEM_PROMPT

    def test_instructs_to_follow_template(self):
        assert "formatting instructions" in SYSTEM_PROMPT.lower() or \
               "section structure" in SYSTEM_PROMPT.lower()


class TestTemplateInjection:
    """Template text should be injected as the primary format directive."""

    def test_no_template_produces_base_prompt_only(self):
        prompt = _build_system_prompt(template="")
        assert prompt == SYSTEM_PROMPT

    def test_soap_template_includes_soap_sections(self):
        prompt = _build_system_prompt(template=SOAP_TEMPLATE)
        assert "Subjective" in prompt
        assert "Assessment" in prompt
        assert "Plan" in prompt

    def test_hp_template_includes_hp_sections(self):
        prompt = _build_system_prompt(template=HP_TEMPLATE)
        assert "Patient Information" in prompt
        assert "Assessment and Plan" in prompt

    def test_hp_template_does_not_add_soap_bias(self):
        prompt = _build_system_prompt(template=HP_TEMPLATE)
        # The only "Subjective" or "Objective" should come from the template, not the base prompt
        # HP template doesn't contain "Subjective" so it shouldn't appear
        base_end = len(SYSTEM_PROMPT)
        base_portion = prompt[:base_end]
        assert "Subjective" not in base_portion
        assert "Objective" not in base_portion

    def test_template_appears_before_context(self):
        prompt = _build_system_prompt(template=SOAP_TEMPLATE, context="Patient has diabetes")
        template_pos = prompt.index("Subjective")
        context_pos = prompt.index("Patient has diabetes")
        assert template_pos < context_pos

    def test_template_uses_directive_phrasing(self):
        prompt = _build_system_prompt(template=SOAP_TEMPLATE)
        assert "Format the note using the following section structure:" in prompt

    def test_empty_string_template_treated_as_no_template(self):
        prompt = _build_system_prompt(template="")
        assert "Format the note" not in prompt
        assert prompt == SYSTEM_PROMPT
