"""Configuration constants for the Adwene sidecar."""

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
MEDGEMMA_MODEL_ID = os.getenv("MEDGEMMA_MODEL_ID", "mlx-community/medgemma-4b-it-4bit")

# -- Decoding configuration --
BEAM_WIDTH: int = int(os.getenv("BEAM_WIDTH", "8"))
USE_LM: bool = os.getenv("USE_LM", "true").lower() == "true"
HOTWORD_WEIGHT: float = float(os.getenv("HOTWORD_WEIGHT", "10.0"))

# -- Hotwords --
# Words/phrases boosted during beam search decoding to improve recognition
# of commonly mis-transcribed terms (numbers, ages, vitals, etc.)
HOTWORDS: list[str] = [
    # Numbers (spoken form)
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand",
    # Age / vitals patterns
    "year", "old", "male", "female",
    "systolic", "diastolic", "pulse", "temperature", "respiratory", "oxygen", "saturation",
    "milligrams", "milliliters", "percent", "pounds", "kilograms",
    # Common clinical terms that benefit from boosting
    "patient", "history", "presents", "presenting", "complains", "complaints",
    "diagnosis", "assessment", "bilateral", "unilateral",
]
