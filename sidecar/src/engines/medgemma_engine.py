"""MedGemma-4B note generation engine — transcript to SOAP note via MLX."""

import asyncio
import logging
from collections.abc import AsyncIterator

from .. import config
from ..prompts import SYSTEM_PROMPT
from .base import NoteEngine

logger = logging.getLogger("adwene-sidecar")

# Maximum time (seconds) for a single generate() call before we abort.
GENERATE_TIMEOUT_S = 120


class MedGemmaEngine(NoteEngine):
    """NoteEngine backed by MedGemma-4B via MLX (Metal GPU)."""

    def __init__(self) -> None:
        self._model = None
        self._tokenizer = None

    async def load(self) -> None:
        logger.info("Loading MedGemma model: %s", config.MEDGEMMA_MODEL_ID)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._load_sync)
        logger.info("MedGemma model loaded (MLX Metal GPU)")

    def _load_sync(self) -> None:
        from mlx_lm import load

        self._model, self._tokenizer = load(config.MEDGEMMA_MODEL_ID)

    async def generate(self, transcript: str, template: str) -> str:
        if self._model is None:
            raise RuntimeError("MedGemma engine not loaded — call load() first")

        loop = asyncio.get_running_loop()
        return await asyncio.wait_for(
            loop.run_in_executor(None, self._generate_sync, transcript, template),
            timeout=GENERATE_TIMEOUT_S,
        )

    def _generate_sync(self, transcript: str, template: str) -> str:
        from mlx_lm import generate

        system = SYSTEM_PROMPT
        if template:
            system += f"\n\nAdditional formatting instructions: {template}"

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Transcript:\n{transcript}"},
        ]

        prompt = self._tokenizer.apply_chat_template(
            messages, add_generation_prompt=True
        )

        return generate(
            self._model,
            self._tokenizer,
            prompt=prompt,
            max_tokens=4096,
        )

    async def generate_stream(
        self, transcript: str, template: str
    ) -> AsyncIterator[str]:
        if self._model is None:
            raise RuntimeError("MedGemma engine not loaded — call load() first")

        loop = asyncio.get_running_loop()

        system = SYSTEM_PROMPT
        if template:
            system += f"\n\nAdditional formatting instructions: {template}"

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Transcript:\n{transcript}"},
        ]

        prompt = self._tokenizer.apply_chat_template(
            messages, add_generation_prompt=True
        )

        # stream_generate is synchronous generator — run in executor with a
        # queue to bridge to async.
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        def _stream() -> None:
            from mlx_lm import stream_generate

            for response in stream_generate(
                self._model,
                self._tokenizer,
                prompt=prompt,
                max_tokens=4096,
            ):
                if response.text:
                    loop.call_soon_threadsafe(queue.put_nowait, response.text)
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

        future = loop.run_in_executor(None, _stream)

        try:
            while True:
                chunk = await asyncio.wait_for(queue.get(), timeout=GENERATE_TIMEOUT_S)
                if chunk is None:
                    break
                yield chunk
        finally:
            await future

    async def unload(self) -> None:
        self._model = None
        self._tokenizer = None
        logger.info("MedGemma model unloaded")
