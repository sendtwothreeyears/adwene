"""Shared prompts for note generation engines."""

import re

from . import config


# ---------------------------------------------------------------------------
# System instructions — VERBATIM from fine-tuning training data
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTIONS = """\
[SYSTEM INSTRUCTIONS]
You are a medical documentation assistant. Your task is to generate a structured clinical note based on a patient encounter transcription.

CRITICAL OUTPUT FORMAT:
- Use markdown headings for section headers (# for top-level sections, ## for sub-sections, ### for sub-sub-sections)
- Use regular paragraphs for content
- Use - for bullet points when listing items

CLINICAL ENTITY MARKING:
When mentioning medications or medical conditions, wrap them using double curly braces:
- Medications: {{drug:medication name}}
- Conditions/Diagnoses: {{condition:condition name}}

Rules for entity marking:
- Only mark the FIRST occurrence of each unique drug or condition
- Use the name as it appears naturally in the note (generic or brand as appropriate)
- Do not mark symptoms, procedures, or lab values—only confirmed diagnoses and medications
- Maintain natural sentence flow; the curly braces should wrap the term seamlessly

Examples:
- "Patient has {{condition:type 2 diabetes}} managed with {{drug:metformin}} 500mg twice daily. We discussed increasing metformin to 1000mg." (note: second "metformin" is NOT marked)
- "History of {{condition:hypertension}}, currently on {{drug:lisinopril}} 10mg."

CRITICAL RULES - FOLLOW EXACTLY:
1. Use ONLY information explicitly stated in the transcription
2. Follow the template structure EXACTLY as provided
3. If a section was discussed (even if findings are "none", "negative", or "no issues"), document what was stated - do NOT write "Not documented"
4. Only write "Not documented" if the topic was truly never mentioned in the transcription
5. ANY TEXT IN PARENTHESES () OR SQUARE BRACKETS [] IN THE TEMPLATE IS AN INSTRUCTION FOR YOU - DO NOT INCLUDE IT IN YOUR OUTPUT
6. For Review of Systems: If the template contains instructions like "(Only include systems that were discussed)", follow that instruction but DO NOT output that text
7. For Physical Examination: Keep findings organized by body system or subsection as shown in the template. Do not combine multiple systems under a single heading
8. Preserve exact template formatting for structured data (like vital signs on separate lines)
9. Do NOT invent, assume, or extrapolate any clinical information beyond what is stated
10. Maintain professional medical terminology and abbreviations as used in the transcription
11. Return ONLY the completed note - no preamble, explanations, or additional commentary
12. STRIP OUT all parenthetical instructions, bracketed instructions, or any text that says "[INSTRUCTION:", "(Only include", etc.
[END SYSTEM INSTRUCTIONS]"""

CLOSING_DIRECTIVE = (
    "Generate a complete medical note by filling in the template above "
    "with information from the transcription. Use markdown headings "
    "(# ## ###) for section headers and regular text for content. "
    "Remember: any text in parentheses () or square brackets [] in the "
    "template are instructions for you - follow them but DO NOT include "
    "them in your output."
)


# ---------------------------------------------------------------------------
# Legacy prompt (kept behind PROMPT_FORMAT=legacy toggle)
# ---------------------------------------------------------------------------

_INSTRUCTIONS_LEGACY = """\
<instructions>
You are a clinical documentation assistant. Generate a clinical note from the transcript below.

Rules:
- Output ONLY the sections listed in the <template> block, in the order listed.
- Use markdown headings (# or ##) for section titles, exactly as they appear in the template.
- Write concise paragraphs using standard medical terminology.
- If a section has no relevant information in the transcript, write "Not documented."
- After completing the final section, stop immediately.
</instructions>"""


def _build_note_prompt_legacy(template: str, transcript: str, context: str = "") -> str:
    """Legacy prompt builder (XML-style format)."""
    parts = [_INSTRUCTIONS_LEGACY]

    if template:
        parts.append(f"<template>\n{template}\n</template>")

    if context:
        parts.append(f"<context>\n{context}\n</context>")

    parts.append(f"<transcript>\n{transcript}\n</transcript>")

    parts.append(
        "Generate the clinical note now. Follow the template above exactly, then stop."
    )

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_note_prompt(template: str, transcript: str, context: str = "") -> str:
    """Assemble the full prompt for clinical note generation.

    Returns a single string to be used as a user-role message.
    MedGemma (Gemma-family) does not reliably support the system role,
    so all instructions go in the user message.

    When ``config.PROMPT_FORMAT`` is ``"training"`` (default), produces the
    exact format used during fine-tuning.  When ``"legacy"``, falls back to
    the old XML-style prompt.
    """
    if config.PROMPT_FORMAT == "legacy":
        return _build_note_prompt_legacy(template, transcript, context)

    # -- Training format --
    parts: list[str] = [SYSTEM_INSTRUCTIONS]

    parts.append(f"TEMPLATE:\n{template}")

    parts.append("---")

    # Build TRANSCRIPTION block
    transcription_lines: list[str] = ["TRANSCRIPTION:"]
    if context:
        transcription_lines.append(f"[Patient context: {context}]")
        transcription_lines.append("")  # blank line after context
    transcription_lines.append(transcript)
    parts.append("\n".join(transcription_lines))

    parts.append(CLOSING_DIRECTIVE)

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------

# Gemma control tokens that leak through skip_special_tokens=True
_STOP_PATTERNS = re.compile(
    r"</model|<unused\d+>|<\|end\|>|<\|assistant\|>"
)


def strip_model_artifacts(text: str) -> str:
    """Truncate output at the first Gemma control token that leaked through.

    MedGemma sometimes emits </model, <unused94>, etc. as plain text
    after the actual note content. Everything after these is internal
    reasoning/metadata that should not be shown to the user.
    """
    match = _STOP_PATTERNS.search(text)
    if match:
        text = text[:match.start()]
    return text.rstrip()


TITLE_PROMPT = """\
Summarize the chief complaint or main topic of this medical encounter in 4 to 5 words. \
The title must be a cohesive phrase, not a truncated sentence. \
Output only the title, nothing else. No punctuation, no explanation."""
