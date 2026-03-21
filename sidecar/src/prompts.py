"""Shared prompts for note generation engines."""

import re


def count_sections(template: str) -> int:
    """Count markdown heading lines (# or ##) in a template string.

    Falls back to counting bold lines (**Section**) if no headings found.
    Returns 0 if no structure is detected.
    """
    headings = re.findall(r"^#{1,2}\s+", template, re.MULTILINE)
    if headings:
        return len(headings)
    bold = re.findall(r"^\*\*.+\*\*", template, re.MULTILINE)
    return len(bold)


def build_note_prompt(template: str, transcript: str, context: str = "") -> str:
    """Assemble the full prompt for clinical note generation.

    Returns a single string to be used as a user-role message.
    MedGemma (Gemma-family) does not reliably support the system role,
    so all instructions go in the user message.
    """
    section_count = count_sections(template)

    parts = [INSTRUCTIONS, ONE_SHOT_EXAMPLE]

    if template:
        parts.append(f"<template>\n{template}\n</template>")

    if context:
        parts.append(f"<context>\n{context}\n</context>")

    parts.append(f"<transcript>\n{transcript}\n</transcript>")

    if section_count > 0:
        parts.append(
            f"Generate the clinical note now. Output exactly {section_count} "
            f"section(s) matching the template above, then stop."
        )
    else:
        parts.append(
            "Generate the clinical note now. Follow the template above exactly, then stop."
        )

    return "\n\n".join(parts)


def estimate_max_tokens(template: str) -> int:
    """Estimate appropriate max_tokens based on template section count."""
    n = count_sections(template)
    if n == 0:
        return 1500
    return max(400, min(2000, n * 350))


INSTRUCTIONS = """\
<instructions>
You are a clinical documentation assistant. Generate a clinical note from the transcript below.

Rules:
- Output ONLY the sections listed in the <template> block, in the order listed.
- Use markdown headings (# or ##) for section titles, exactly as they appear in the template.
- Write concise paragraphs using standard medical terminology.
- If a section has no relevant information in the transcript, write "Not documented."
- After completing the final section, stop immediately.
</instructions>"""

ONE_SHOT_EXAMPLE = """\
<example>
Given this template:
## Chief Complaint
## Assessment

The correct output is:

## Chief Complaint
Patient presents with right knee pain for 3 weeks following a fall.

## Assessment
Right knee contusion with possible meniscal injury. Recommend MRI for further evaluation.

(Exactly 2 sections were in the template, so exactly 2 sections were output.)
</example>"""

TITLE_PROMPT = """\
Summarize the chief complaint or main topic of this medical encounter in 4 to 5 words. \
The title must be a cohesive phrase, not a truncated sentence. \
Output only the title, nothing else. No punctuation, no explanation."""
