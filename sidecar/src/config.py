"""Configuration constants for the Adwene sidecar."""

HOST = "localhost"
PORT = 8765

# -- ASR engine selection --
# Change this value to swap the speech-to-text model.
# Available engines are registered in engines/registry.py.
ASR_ENGINE = "medasr"

# -- Note engine selection --
# Change this value to swap the note generation model.
NOTE_ENGINE = "gemma"

# -- Model identifiers --
MEDASR_MLX_MODEL_ID = "google/medasr"  # mlx-audio auto-downloads + caches from HuggingFace
GEMMA_MODEL_ID = "mlx-community/gemma-3n-E2B-it-lm-4bit"  # Gemma 3N E2B 4-bit quantized, MLX native

# -- Decoding configuration --
BEAM_WIDTH: int = 8          # beam search width (Google's default)
USE_LM: bool = True          # enable KenLM language model
HOTWORD_WEIGHT: float = 10.0 # boost weight for hotwords

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
