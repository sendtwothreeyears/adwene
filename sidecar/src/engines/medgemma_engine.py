"""MedGemma 1.5-4B note generation engine — transcript to clinical note via mlx-vlm."""

import asyncio
import logging
from collections.abc import AsyncIterator

import mlx.core as mx

from .. import config
from ..prompts import TITLE_PROMPT, _STOP_PATTERNS, build_note_prompt, estimate_max_tokens, strip_model_artifacts
from .base import NoteEngine

logger = logging.getLogger("kasamd-sidecar")

# Maximum time (seconds) for a single generate() call before we abort.
GENERATE_TIMEOUT_S = 120


class MedGemmaEngine(NoteEngine):
    """NoteEngine backed by MedGemma 1.5-4B via mlx-vlm (Metal GPU)."""

    def __init__(self) -> None:
        self._model = None
        self._processor = None

    async def load(self) -> None:
        logger.info("Loading MedGemma model: %s", config.MEDGEMMA_MODEL_ID)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._load_sync)
        logger.info("MedGemma model loaded (mlx-vlm Metal GPU)")

    def _load_sync(self) -> None:
        from mlx_vlm import load

        self._model, self._processor = load(config.MEDGEMMA_MODEL_ID)

    def _format_prompt(self, messages: list[dict]) -> str:
        """Apply the Gemma chat template to a list of messages via mlx-vlm."""
        from mlx_vlm.prompt_utils import apply_chat_template

        model_config = self._model.config if hasattr(self._model, "config") else {}
        return apply_chat_template(
            self._processor, model_config, messages, num_images=0
        )

    async def generate(self, transcript: str, template: str) -> str:
        if self._model is None:
            raise RuntimeError("MedGemma engine not loaded — call load() first")

        loop = asyncio.get_running_loop()
        from ..server import _mlx_executor
        return await asyncio.wait_for(
            loop.run_in_executor(_mlx_executor, self._generate_sync, transcript, template),
            timeout=GENERATE_TIMEOUT_S,
        )

    def _generate_sync(self, transcript: str, template: str, context: str = "") -> str:
        from mlx_vlm import generate

        prompt_text = build_note_prompt(template, transcript, context)
        messages = [{"role": "user", "content": prompt_text}]
        prompt = self._format_prompt(messages)

        max_tokens = estimate_max_tokens(template) if template else config.MEDGEMMA_MAX_TOKENS

        # Reset stopping criteria so generate() stops at EOS tokens
        tokenizer = self._processor.tokenizer if hasattr(self._processor, "tokenizer") else self._processor
        eos_token_ids = getattr(self._model.config, "eos_token_id", [1, 106])
        tokenizer.stopping_criteria.reset(eos_token_ids)

        result = generate(
            self._model,
            self._processor,
            prompt,
            max_tokens=max_tokens,
            verbose=False,
            temperature=config.MEDGEMMA_TEMPERATURE,
            repetition_penalty=config.MEDGEMMA_REPETITION_PENALTY,
            repetition_context_size=config.MEDGEMMA_REPETITION_CONTEXT_SIZE,
            top_p=config.MEDGEMMA_TOP_P,
        )
        mx.synchronize()  # Flush Metal command buffers before releasing executor

        output = strip_model_artifacts(result.text)

        # Post-hoc repetition detection
        from ..repetition_detector import RepetitionDetector

        detector = RepetitionDetector()
        detector.feed(output)
        if detector.is_looping:
            clean = detector.clean_text
            logger.warning(
                "Repetition loop detected, truncated at %d chars (original %d chars)",
                len(clean),
                len(output),
            )
            return clean

        return output

    async def generate_stream(
        self, transcript: str, template: str, context: str = ""
    ) -> AsyncIterator[str]:
        if self._model is None:
            raise RuntimeError("MedGemma engine not loaded — call load() first")

        loop = asyncio.get_running_loop()

        prompt_text = build_note_prompt(template, transcript, context)
        messages = [{"role": "user", "content": prompt_text}]
        prompt = self._format_prompt(messages)

        max_tokens = estimate_max_tokens(template) if template else config.MEDGEMMA_MAX_TOKENS

        # stream_generate is synchronous generator — run in executor with a
        # queue to bridge to async.  A sentinel of None means "done";
        # a sentinel of _LOOP_DETECTED means the detector fired in the
        # executor thread.
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        from ..repetition_detector import RepetitionDetector

        detector = RepetitionDetector()

        def _stream() -> None:
            from mlx_vlm import stream_generate

            tokenizer = (
                self._processor.tokenizer
                if hasattr(self._processor, "tokenizer")
                else self._processor
            )

            # Reset stopping criteria so stream_generate stops at EOS tokens
            eos_token_ids = getattr(self._model.config, "eos_token_id", [1, 106])
            tokenizer.stopping_criteria.reset(eos_token_ids)

            token_ids: list[int] = []
            prev_text = ""

            for response in stream_generate(
                self._model,
                self._processor,
                prompt,
                max_tokens=max_tokens,
                temperature=config.MEDGEMMA_TEMPERATURE,
                repetition_penalty=config.MEDGEMMA_REPETITION_PENALTY,
                repetition_context_size=config.MEDGEMMA_REPETITION_CONTEXT_SIZE,
                top_p=config.MEDGEMMA_TOP_P,
            ):
                token = response.token if hasattr(response, "token") else None
                if token is None:
                    continue
                # token may be an mlx scalar — convert to int
                tid = int(token)
                token_ids.append(tid)

                # Decode all tokens so far to get the full text
                decoded = tokenizer.decode(token_ids, skip_special_tokens=True)
                # Skip if decode produced a replacement character (incomplete UTF-8)
                if "\ufffd" in decoded[len(prev_text):]:
                    continue
                chunk = decoded[len(prev_text):]
                if chunk:
                    # Check for Gemma control tokens leaking through
                    stop_match = _STOP_PATTERNS.search(chunk)
                    if stop_match:
                        # Send only the text before the control token
                        clean_chunk = chunk[:stop_match.start()]
                        if clean_chunk:
                            loop.call_soon_threadsafe(queue.put_nowait, clean_chunk)
                        logger.info("Model artifact detected, stopping stream")
                        break
                    prev_text = decoded
                    detector.feed(chunk)
                    if detector.is_looping:
                        logger.warning(
                            "Repetition loop detected during streaming, "
                            "truncated at %d chars",
                            len(detector.clean_text),
                        )
                        break
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)

            # Final decode to catch any trailing text
            if token_ids:
                final = tokenizer.decode(token_ids, skip_special_tokens=True)
                trailing = final[len(prev_text):]
                if trailing:
                    loop.call_soon_threadsafe(queue.put_nowait, trailing)

            mx.synchronize()  # Flush Metal command buffers before releasing executor
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

        from ..server import _mlx_executor
        future = loop.run_in_executor(_mlx_executor, _stream)

        try:
            while True:
                chunk = await asyncio.wait_for(queue.get(), timeout=GENERATE_TIMEOUT_S)
                if chunk is None:
                    break
                yield chunk
        finally:
            await future

    async def generate_title(self, transcript: str) -> str:
        if self._model is None:
            raise RuntimeError("MedGemma engine not loaded — call load() first")

        loop = asyncio.get_running_loop()
        from ..server import _mlx_executor
        return await asyncio.wait_for(
            loop.run_in_executor(_mlx_executor, self._generate_title_sync, transcript),
            timeout=GENERATE_TIMEOUT_S,
        )

    def _generate_title_sync(self, transcript: str) -> str:
        from mlx_vlm import generate

        messages = [
            {"role": "user", "content": f"{TITLE_PROMPT}\n\nTranscript:\n{transcript}"},
        ]

        prompt = self._format_prompt(messages)

        tokenizer = self._processor.tokenizer if hasattr(self._processor, "tokenizer") else self._processor
        eos_token_ids = getattr(self._model.config, "eos_token_id", [1, 106])
        tokenizer.stopping_criteria.reset(eos_token_ids)

        result = generate(
            self._model,
            self._processor,
            prompt,
            max_tokens=32,
            verbose=False,
            temperature=config.MEDGEMMA_TEMPERATURE,
            top_p=config.MEDGEMMA_TOP_P,
        )
        mx.synchronize()  # Flush Metal command buffers before releasing executor
        return strip_model_artifacts(result.text)

    async def unload(self) -> None:
        self._model = None
        self._processor = None
        logger.info("MedGemma model unloaded")
