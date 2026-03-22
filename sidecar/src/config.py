"""Configuration constants for the KasaMD sidecar."""

import os

HOST = os.getenv("SIDECAR_HOST", "localhost")
PORT = int(os.getenv("SIDECAR_PORT", "8765"))

# -- ASR engine selection --
# Available engines are registered in engines/registry.py.
ASR_ENGINE = os.getenv("ASR_ENGINE", "medasr")

# -- Note engine selection --
NOTE_ENGINE = os.getenv("NOTE_ENGINE", "medgemma")

# -- Model identifiers --
MEDASR_MLX_MODEL_ID = os.getenv("MEDASR_MLX_MODEL_ID", "google/medasr")
GEMMA_MODEL_ID = os.getenv("GEMMA_MODEL_ID", "mlx-community/gemma-3n-E2B-it-lm-4bit")
MEDGEMMA_MODEL_ID = os.getenv("MEDGEMMA_MODEL_ID", "/Users/Shared/Code/kasamd_offline/models/medgemma-1.5-4b-ft-4bit")

# -- MedGemma generation parameters --
# Lower temperature for deterministic clinical output; mild repetition_penalty
# avoids incentivising transcript copying (high penalty makes model's own tokens
# expensive, pushing it toward verbatim transcript).
MEDGEMMA_TEMPERATURE: float = float(os.getenv("MEDGEMMA_TEMPERATURE", "0.35"))
MEDGEMMA_REPETITION_PENALTY: float = float(os.getenv("MEDGEMMA_REPETITION_PENALTY", "1.05"))
MEDGEMMA_REPETITION_CONTEXT_SIZE: int = int(os.getenv("MEDGEMMA_REPETITION_CONTEXT_SIZE", "128"))
MEDGEMMA_TOP_P: float = float(os.getenv("MEDGEMMA_TOP_P", "0.65"))
MEDGEMMA_MAX_TOKENS: int = int(os.getenv("MEDGEMMA_MAX_TOKENS", "2048"))

# -- Prompt format toggle --
# "training" = exact fine-tuning format; "legacy" = old XML-style prompt
PROMPT_FORMAT: str = os.environ.get("PROMPT_FORMAT", "training")

# -- Repetition detector parameters --
REPETITION_NGRAM_SIZE: int = int(os.getenv("REPETITION_NGRAM_SIZE", "5"))
REPETITION_MAX_OCCURRENCES: int = int(os.getenv("REPETITION_MAX_OCCURRENCES", "4"))
REPETITION_WINDOW_WORDS: int = int(os.getenv("REPETITION_WINDOW_WORDS", "250"))

# -- Decoding configuration --
BEAM_WIDTH: int = int(os.getenv("BEAM_WIDTH", "8"))
USE_LM: bool = os.getenv("USE_LM", "true").lower() == "true"
HOTWORD_WEIGHT: float = float(os.getenv("HOTWORD_WEIGHT", "10.0"))

# -- Audio buffer --
# Maximum audio buffer size in megabytes.  Determines how much raw PCM audio
# the sidecar retains during a streaming session.  Larger values allow
# full-audio re-transcription of longer recordings after stop.
MAX_AUDIO_BUFFER_MB: float = float(os.getenv("MAX_AUDIO_BUFFER_MB", "60"))

# -- Transcript logging --
TRANSCRIPT_LOG_ENABLED: bool = os.getenv("TRANSCRIPT_LOG_ENABLED", "true").lower() == "true"
TRANSCRIPT_LOG_DIR: str = os.getenv("TRANSCRIPT_LOG_DIR", os.path.expanduser("~/.kasamd/transcript_logs"))

# -- Hotwords --
# Words/phrases boosted during beam search decoding to improve recognition
# of commonly mis-transcribed terms (numbers, ages, vitals, etc.)
HOTWORDS: list[str] = [
    # Numbers — the one category the medical LM is weak on, since spoken
    # numbers ("sixty-eight") map to many possible digit forms.
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand",
    # Age / vitals units — also weakly covered by LM
    "year", "old", "male", "female",
    "milligrams", "milliliters", "percent", "pounds", "kilograms",
]
