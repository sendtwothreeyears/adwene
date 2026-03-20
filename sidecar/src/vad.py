"""Streaming Voice Activity Detection using Silero VAD (ONNX).

Loads the Silero VAD v5 ONNX model via onnxruntime (no PyTorch dependency).
Processes Int16 PCM audio chunks of any size, reframes into 32ms windows,
and emits completed utterance audio when speech-to-silence transitions are
detected.

Technology choice rationale (Task 09):
- silero-vad (PyPI) rejected: requires PyTorch (~2GB), violates MLX-only constraint
- silero-vad-lite rejected: no Python 3.14 wheel, stale maintenance
- webrtcvad rejected: GMM-based, lower accuracy than neural Silero
- onnxruntime chosen: ~17MB wheel, pre-built cp314 ARM64 wheel, identical
  accuracy to PyTorch Silero, full control over streaming state
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import onnxruntime

logger = logging.getLogger("kasamd-sidecar")

# Silero VAD ONNX model constants
_SAMPLE_RATE = 16_000
_WINDOW_SAMPLES = 512  # 32ms at 16kHz (model's expected input size)
_CONTEXT_SAMPLES = 64  # prepended to each window for model context
_STATE_SHAPE = (2, 1, 128)  # LSTM state: (layers, batch, hidden)


class SileroVAD:
    """Streaming VAD that accumulates utterance audio and returns complete segments.

    Usage::

        vad = SileroVAD()

        # Feed PCM chunks as they arrive from the WebSocket (any size)
        for chunk in audio_stream:
            utterances = vad.process_chunk(chunk)
            for utterance_pcm in utterances:
                text = await asr_engine.transcribe(utterance_pcm)

        # On session end, flush any remaining speech
        final = vad.flush()
        if final:
            text = await asr_engine.transcribe(final)
    """

    def __init__(
        self,
        model_path: str | Path | None = None,
        threshold: float = 0.5,
        silence_threshold: float = 0.35,
        min_speech_ms: int = 250,
        min_silence_ms: int = 700,
        max_speech_ms: int = 60_000,
    ):
        """Initialize the VAD.

        Args:
            model_path: Path to silero_vad.onnx. Defaults to sidecar/models/silero_vad.onnx.
            threshold: Probability above which a frame is classified as speech.
            silence_threshold: Probability below which speech is considered ended
                (hysteresis to reduce flicker).
            min_speech_ms: Minimum speech duration to emit a segment (filters transients).
            min_silence_ms: Silence duration required before ending a speech segment.
            max_speech_ms: Force-segment after this much continuous speech.
        """
        if model_path is None:
            model_path = Path(__file__).parent.parent / "models" / "silero_vad.onnx"
        model_path = str(model_path)

        opts = onnxruntime.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        opts.log_severity_level = 3  # suppress onnxruntime info logs

        self._session = onnxruntime.InferenceSession(
            model_path,
            providers=["CPUExecutionProvider"],
            sess_options=opts,
        )

        self._threshold = threshold
        self._silence_threshold = silence_threshold
        self._min_speech_samples = int(min_speech_ms * _SAMPLE_RATE / 1000)
        self._min_silence_samples = int(min_silence_ms * _SAMPLE_RATE / 1000)
        self._max_speech_samples = int(max_speech_ms * _SAMPLE_RATE / 1000)

        self._sr = np.array(_SAMPLE_RATE, dtype="int64")
        self.reset()

    def reset(self) -> None:
        """Reset all streaming state for a new session."""
        self._state = np.zeros(_STATE_SHAPE, dtype="float32")
        self._context = np.zeros((1, _CONTEXT_SAMPLES), dtype="float32")
        self._in_speech = False
        self._speech_buf = bytearray()  # raw Int16 PCM accumulator
        self._speech_samples = 0  # samples in current speech segment
        self._silence_samples = 0  # consecutive silence samples
        self._leftover = np.array([], dtype="float32")  # partial window carry

    def process_chunk(self, pcm_bytes: bytes) -> list[bytes]:
        """Process a chunk of Int16 PCM audio.

        Args:
            pcm_bytes: Raw PCM audio, 16kHz mono Int16 little-endian. Any size.

        Returns:
            List of completed utterances as raw Int16 PCM bytes.
            Usually empty or one item; could contain multiple if
            multiple utterances end within one chunk.
        """
        # Convert Int16 PCM -> float32 normalized to [-1, 1]
        audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        # Prepend any leftover from previous chunk
        if len(self._leftover) > 0:
            audio = np.concatenate([self._leftover, audio])
            self._leftover = np.array([], dtype="float32")

        completed: list[bytes] = []
        offset = 0

        while offset + _WINDOW_SAMPLES <= len(audio):
            window = audio[offset : offset + _WINDOW_SAMPLES]
            window_int16_bytes = (
                (window * 32768.0).clip(-32768, 32767).astype(np.int16).tobytes()
            )

            prob = self._infer(window)
            result = self._update_state(prob, window_int16_bytes)
            if result is not None:
                completed.append(result)

            offset += _WINDOW_SAMPLES

        # Save leftover samples for next chunk
        if offset < len(audio):
            self._leftover = audio[offset:]

        return completed

    @property
    def in_speech(self) -> bool:
        """True if VAD is currently detecting speech."""
        return self._in_speech

    @property
    def speech_duration_ms(self) -> float:
        """Duration of current speech segment in milliseconds."""
        return self._speech_samples / _SAMPLE_RATE * 1000

    def peek_speech(self, max_tail_ms: int = 0) -> bytes | None:
        """Return current speech buffer without consuming it.

        Used for partial/interim transcription while speech is ongoing.
        Returns None if not in speech or below minimum duration.

        Args:
            max_tail_ms: If > 0, return only the last N ms of the speech
                buffer. Useful for partial transcription where full context
                is unnecessary and would cause O(duration) feature extraction.
        """
        if self._in_speech and self._speech_samples >= self._min_speech_samples:
            if max_tail_ms > 0:
                max_bytes = int(max_tail_ms * _SAMPLE_RATE / 1000) * 2  # Int16 = 2 bytes
                if len(self._speech_buf) > max_bytes:
                    return bytes(self._speech_buf[-max_bytes:])
            return bytes(self._speech_buf)
        return None

    def flush(self) -> bytes | None:
        """Flush any remaining speech buffer (call on session end).

        Returns the accumulated utterance if in speech and above min duration,
        else None.
        """
        if self._in_speech and self._speech_samples >= self._min_speech_samples:
            result = bytes(self._speech_buf)
            self._reset_speech()
            return result
        self._reset_speech()
        return None

    def _infer(self, window: np.ndarray) -> float:
        """Run one 32ms window through the ONNX model.

        Args:
            window: Float32 array of _WINDOW_SAMPLES values in [-1, 1].

        Returns:
            Speech probability (0.0 to 1.0).
        """
        # Prepend context to window
        x = np.concatenate([self._context[0], window]).reshape(1, -1)

        ort_inputs = {
            "input": x,
            "state": self._state,
            "sr": self._sr,
        }
        out, self._state = self._session.run(None, ort_inputs)

        # Update context with last 64 samples of input
        self._context = x[:, -_CONTEXT_SAMPLES:]

        return float(out[0][0])

    def _update_state(self, prob: float, window_bytes: bytes) -> bytes | None:
        """Update the speech/silence state machine.

        Returns a completed utterance (Int16 PCM bytes) if speech ended,
        else None.
        """
        if prob >= self._threshold:
            # Speech detected
            self._silence_samples = 0
            self._speech_samples += _WINDOW_SAMPLES

            if not self._in_speech:
                self._in_speech = True
                self._speech_buf = bytearray()

            self._speech_buf.extend(window_bytes)

            # Force-segment if speech exceeds max duration
            if self._speech_samples >= self._max_speech_samples:
                logger.info(
                    "Force-segmenting after %.1fs of continuous speech",
                    self._speech_samples / _SAMPLE_RATE,
                )
                result = bytes(self._speech_buf)
                self._reset_speech()
                return result

        elif prob < self._silence_threshold and self._in_speech:
            # Below silence threshold while in speech — count silence
            self._silence_samples += _WINDOW_SAMPLES
            self._speech_buf.extend(window_bytes)  # include trailing silence

            if self._silence_samples >= self._min_silence_samples:
                # Enough silence — emit the utterance
                if self._speech_samples >= self._min_speech_samples:
                    result = bytes(self._speech_buf)
                    self._reset_speech()
                    return result
                else:
                    # Too short (transient) — discard
                    logger.debug(
                        "Discarding short segment: %dms",
                        self._speech_samples * 1000 // _SAMPLE_RATE,
                    )
                    self._reset_speech()

        elif self._in_speech:
            # Between thresholds — keep accumulating (hysteresis zone)
            self._speech_buf.extend(window_bytes)
            self._speech_samples += _WINDOW_SAMPLES

        return None

    def clear_speech_buffer(self) -> None:
        """Clear the speech buffer without resetting LSTM neural state.

        Use this after a fallback batch commits audio that the VAD was
        tracking. Preserves the model's acoustic context (LSTM state,
        context buffer, leftover samples) so it can continue detecting
        speech without a re-convergence gap.
        """
        self._reset_speech()

    def _reset_speech(self) -> None:
        """Reset speech-tracking state back to silence."""
        self._in_speech = False
        self._speech_buf = bytearray()
        self._speech_samples = 0
        self._silence_samples = 0
