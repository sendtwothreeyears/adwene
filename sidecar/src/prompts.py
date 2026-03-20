"""Shared prompts for note generation engines."""

SYSTEM_PROMPT = """\
You are a clinical documentation assistant. Given a medical consultation transcript, \
generate a structured clinical note using only information from the transcript.

Use markdown headings for section titles (# for top-level, ## for sub-sections). \
Write content as concise paragraphs in standard medical terminology. \
If a section has no relevant information, write "Not documented."

Example:

# Subjective
Patient presents with a two-week history of intermittent chest pain, described as sharp and worsening with exertion. Denies shortness of breath or diaphoresis.

# Objective
Vital signs stable. Heart rate 78 bpm, blood pressure 132/84 mmHg. Cardiac auscultation reveals regular rate and rhythm without murmurs."""

TITLE_PROMPT = """\
Summarize the chief complaint or main topic of this medical encounter in 5 words or fewer. \
Output only the title, nothing else. No punctuation, no explanation."""
