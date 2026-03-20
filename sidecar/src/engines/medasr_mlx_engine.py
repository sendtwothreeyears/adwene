"""MedASR speech-to-text engine using MLX (Apple Silicon GPU via Metal)."""

import asyncio
import logging
import time
from pathlib import Path

import mlx.core as mx
import mlx.nn as nn
import numpy as np
from tokenizers import Tokenizer

from .. import config
from .base import ASREngine

logger = logging.getLogger("kasamd-sidecar")

SAMPLE_RATE = 16_000  # Hz — must match the frontend capture pipeline
_MIN_SAMPLES = 2_240  # ~140ms at 16 kHz — minimum for model conv layers


class MedASRMLXEngine(ASREngine):
    """ASREngine backed by google/medasr via mlx-audio (Metal GPU acceleration)."""

    def __init__(self) -> None:
        self._model = None
        self._tokenizer = None
        self._mel_filters = None
        self._beam_decoder = None

    async def load(self) -> None:
        logger.info("Loading MedASR MLX model: %s", config.MEDASR_MLX_MODEL_ID)

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._load_sync)

        logger.info("MedASR MLX model loaded (Metal GPU)")

    def _load_sync(self) -> None:
        from mlx_audio.stt.utils import load

        self._model = load(config.MEDASR_MLX_MODEL_ID, strict=False)
        self._model.eval()

        # Resolve model path to load tokenizer
        from mlx_audio.utils import get_model_path

        model_path = get_model_path(config.MEDASR_MLX_MODEL_ID)
        tokenizer_path = Path(model_path) / "tokenizer.json"
        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))

        # Pre-compute mel filter bank
        self._mel_filters = _linear_to_mel_weight_matrix(
            num_mel_bins=128,
            num_spectrogram_bins=257,  # n_fft // 2 + 1
            sample_rate=SAMPLE_RATE,
        )

        # Build beam search decoder with KenLM language model
        self._beam_decoder = _build_beam_decoder(Path(model_path), self._tokenizer)

        logger.info("Tokenizer loaded, mel filters ready")

    async def transcribe(self, audio_bytes: bytes) -> str:
        if self._model is None:
            raise RuntimeError("MedASR MLX engine not loaded — call load() first")

        # Convert Int16 PCM bytes -> float32 numpy array in [-1, 1]
        pcm_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
        if len(pcm_int16) < _MIN_SAMPLES:
            return ""
        audio_float = pcm_int16.astype(np.float32) / 32768.0

        loop = asyncio.get_running_loop()
        # Use the dedicated MLX executor to prevent concurrent Metal GPU calls.
        # Imported here to avoid circular dependency at module level.
        from ..server import _mlx_executor
        text = await loop.run_in_executor(_mlx_executor, self._transcribe_sync, audio_float)
        return text

    def _transcribe_sync(self, audio: np.ndarray) -> str:
        # Extract log-mel spectrogram features
        features = _extract_features(audio, self._mel_filters)
        features_mx = mx.array(features[np.newaxis, :, :])

        # Run model inference (Metal GPU)
        t0 = time.perf_counter()
        logits = self._model(features_mx)
        t_inference = time.perf_counter() - t0

        if self._beam_decoder is not None:
            t1 = time.perf_counter()
            text = self._decode_beam_search(logits)
            t_decode = time.perf_counter() - t1
            logger.debug(
                "Transcribe: inference=%.0fms, beam_decode=%.0fms",
                t_inference * 1000, t_decode * 1000,
            )
            return text

        t1 = time.perf_counter()
        text = self._decode_greedy(logits)
        t_decode = time.perf_counter() - t1
        logger.debug(
            "Transcribe: inference=%.0fms, greedy_decode=%.0fms",
            t_inference * 1000, t_decode * 1000,
        )
        return text

    def _decode_beam_search(self, logits: mx.array) -> str:
        logprobs = nn.log_softmax(logits, axis=-1)
        logprobs_np = np.array(logprobs[0])  # shape: (T, vocab_size)

        result = self._beam_decoder.decode(
            logprobs_np,
            beam_width=config.BEAM_WIDTH,
            hotwords=config.HOTWORDS,
            hotword_weight=config.HOTWORD_WEIGHT,
        )
        return _restore_text(result)

    def _decode_greedy(self, logits: mx.array) -> str:
        logprobs = nn.log_softmax(logits, axis=-1)
        tokens = mx.argmax(logprobs, axis=-1)[0].tolist()

        # CTC decode: collapse consecutive duplicates, remove blanks (id=0)
        collapsed = []
        prev = None
        for t in tokens:
            if t != 0 and t != prev:
                collapsed.append(t)
            prev = t

        if not collapsed:
            return ""

        return self._tokenizer.decode(collapsed)

    async def unload(self) -> None:
        self._model = None
        self._tokenizer = None
        self._mel_filters = None
        self._beam_decoder = None
        logger.info("MedASR MLX model unloaded")


# ---------------------------------------------------------------------------
# Beam search decoder construction
# ---------------------------------------------------------------------------

def _build_beam_decoder(model_path: Path, tokenizer: Tokenizer):
    """Build a pyctcdecode beam search decoder with KenLM language model.

    Returns None if pyctcdecode is not installed (graceful degradation).
    """
    try:
        from pyctcdecode import build_ctcdecoder
    except ImportError:
        logger.warning(
            "pyctcdecode not installed — using greedy decoding. "
            "Install with: pip install pyctcdecode camel-kenlm"
        )
        return None

    # Build ordered vocabulary list indexed by token ID.
    # The tokenizer has 613 entries (includes <pad> and <extra_id_*> added tokens)
    # but the CTC head only outputs 512 logits — truncate to match model output.
    import json
    model_config = json.loads((model_path / "config.json").read_text())
    ctc_vocab_size = model_config["vocab_size"]

    vocab_dict = tokenizer.get_vocab()
    vocab = [""] * ctc_vocab_size
    for token, idx in vocab_dict.items():
        if idx < ctc_vocab_size:
            vocab[idx] = token

    # Token 0 (<epsilon>) is the CTC blank — pyctcdecode expects ""
    vocab[0] = ""

    # Transform tokens for pyctcdecode compatibility:
    # - Prefix non-special tokens with ▁ (word boundary marker)
    # - Replace existing ▁ in tokens with # to avoid conflicts
    # This follows Google's official MedASR approach.
    special_tokens = {"", "<s>", "</s>", "<unk>"}
    for i, token in enumerate(vocab):
        if token in special_tokens:
            continue
        vocab[i] = "▁" + token.replace("▁", "#")

    # Locate KenLM language model file
    kenlm_path = model_path / "lm_6.kenlm"
    if not kenlm_path.exists():
        try:
            from huggingface_hub import hf_hub_download
            kenlm_path = Path(hf_hub_download(
                repo_id=config.MEDASR_MLX_MODEL_ID,
                filename="lm_6.kenlm",
            ))
        except (OSError, ImportError) as exc:
            logger.warning("KenLM file not found — beam search without LM: %s", exc)
            kenlm_path = None

    kenlm_model_path = str(kenlm_path) if kenlm_path and config.USE_LM else None

    # Provide unigrams for beam pruning. pyctcdecode strips the ▁ prefix from
    # labels when scoring through KenLM, so unigrams are the "word" forms KenLM sees
    # (e.g. "#the", "s", "ed"). Without this, pyctcdecode can't prune from .kenlm binaries.
    unigrams = [
        t.lstrip("▁") for t in vocab
        if t and t not in {"<s>", "</s>", "▁⁇▁"}
    ]

    try:
        decoder = build_ctcdecoder(
            labels=vocab,
            kenlm_model_path=kenlm_model_path,
            unigrams=unigrams,
        )
    except Exception as exc:
        logger.warning("Beam search decoder construction failed — using greedy decoding: %s", exc)
        return None

    logger.info(
        "Beam search decoder built (KenLM: %s)",
        kenlm_model_path is not None,
    )
    return decoder


def _restore_text(text: str) -> str:
    """Reverse the token transformation applied for pyctcdecode."""
    # 1. Remove spaces (pyctcdecode word separators between ▁-prefixed tokens)
    # 2. Replace # with space (restore original ▁ word boundaries)
    # 3. Remove EOS tokens, normalize whitespace
    return " ".join(
        text.replace(" ", "").replace("#", " ").replace("</s>", "").split()
    )


# ---------------------------------------------------------------------------
# Feature extraction (pure numpy — no torch dependency)
# Reimplements LasrFeatureExtractor from transformers using the same algorithm.
# ---------------------------------------------------------------------------

def _hertz_to_mel_kaldi(freq: np.ndarray | float) -> np.ndarray | float:
    """Convert frequency in hertz to mel scale (Kaldi convention)."""
    return 1127.0 * np.log(1.0 + (freq / 700.0))


def _linear_to_mel_weight_matrix(
    num_mel_bins: int,
    num_spectrogram_bins: int,
    sample_rate: float,
    lower_edge_hertz: float = 125.0,
    upper_edge_hertz: float = 7500.0,
) -> np.ndarray:
    """Build mel filter bank matrix (matches LasrFeatureExtractor)."""
    dtype = np.float64
    bands_to_zero = 1
    nyquist_hertz = sample_rate / 2.0
    linear_frequencies = np.linspace(
        0.0, nyquist_hertz, num_spectrogram_bins, dtype=dtype
    )[bands_to_zero:]
    spectrogram_bins_mel = _hertz_to_mel_kaldi(linear_frequencies)[:, np.newaxis]

    edges = np.linspace(
        _hertz_to_mel_kaldi(lower_edge_hertz),
        _hertz_to_mel_kaldi(upper_edge_hertz),
        num_mel_bins + 2,
        dtype=dtype,
    )

    lower_edge_mel = edges[:-2][np.newaxis, :]
    center_mel = edges[1:-1][np.newaxis, :]
    upper_edge_mel = edges[2:][np.newaxis, :]

    lower_slopes = (spectrogram_bins_mel - lower_edge_mel) / (
        center_mel - lower_edge_mel
    )
    upper_slopes = (upper_edge_mel - spectrogram_bins_mel) / (
        upper_edge_mel - center_mel
    )
    mel_weights = np.maximum(0.0, np.minimum(lower_slopes, upper_slopes))
    return np.pad(mel_weights, [[bands_to_zero, 0], [0, 0]]).astype(np.float32)


def _extract_features(
    audio: np.ndarray,
    mel_filters: np.ndarray,
    n_fft: int = 512,
    hop_length: int = 160,
    win_length: int = 400,
) -> np.ndarray:
    """Extract log-mel spectrogram features from raw audio.

    Matches LasrFeatureExtractor._torch_extract_fbank_features().
    """
    # Symmetric Hann window (periodic=False), matching torch.hann_window
    window = np.hanning(win_length).astype(np.float64)
    audio_f64 = audio.astype(np.float64)

    # Unfold audio into overlapping frames
    n_frames = 1 + (len(audio_f64) - win_length) // hop_length
    if n_frames <= 0:
        return np.zeros((1, mel_filters.shape[1]), dtype=np.float32)

    frames = np.lib.stride_tricks.as_strided(
        audio_f64,
        shape=(n_frames, win_length),
        strides=(hop_length * audio_f64.strides[0], audio_f64.strides[0]),
    )

    # Apply window and compute FFT
    windowed = frames * window
    stft = np.fft.rfft(windowed, n=n_fft)
    power_spec = np.abs(stft) ** 2

    # Apply mel filter bank and take log
    mel_spec = np.maximum(power_spec @ mel_filters, 1e-5)
    log_mel = np.log(mel_spec)

    return log_mel.astype(np.float32)
