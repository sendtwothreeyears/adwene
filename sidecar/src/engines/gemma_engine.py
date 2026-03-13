"""Gemma 3N note generation engine — transcript to SOAP note via MLX."""

import asyncio
import logging
from collections.abc import AsyncIterator

from .. import config
from .base import NoteEngine

logger = logging.getLogger("adwene-sidecar")

# Maximum time (seconds) for a single generate() call before we abort.
GENERATE_TIMEOUT_S = 120

SYSTEM_PROMPT = """\
You are a clinical documentation assistant. Given a medical consultation transcript, \
generate a structured SOAP note with the following sections:

# Subjective
Patient's reported symptoms, complaints, and history as described in the transcript.

# Objective
Observable findings, vital signs, and examination results mentioned.

# Assessment
Clinical assessment, differential diagnosis, or working diagnosis.

# Plan
Treatment plan, prescriptions, follow-up instructions, and referrals.

Be concise, professional, and use standard medical terminology. \
If information for a section is not available in the transcript, write only "Not documented." with no further explanation. \
Do not fabricate clinical details not present in the transcript. \
Output ONLY the SOAP note sections. Do not add disclaimers, meta-commentary, "Important Considerations", \
caveats about partial transcripts, assumptions, or professional disclaimers. \
Never mention that you are an AI or that the note is a template."""


class GemmaEngine(NoteEngine):
    """NoteEngine backed by Gemma 3N E2B via MLX (Metal GPU)."""

    def __init__(self) -> None:
        self._model = None
        self._tokenizer = None

    async def load(self) -> None:
        logger.info("Loading Gemma model: %s", config.GEMMA_MODEL_ID)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._load_sync)
        logger.info("Gemma model loaded (MLX Metal GPU)")

    def _load_sync(self) -> None:
        from mlx_lm import load

        self._model, self._tokenizer = load(config.GEMMA_MODEL_ID)

    async def generate(self, transcript: str, template: str) -> str:
        if self._model is None:
            raise RuntimeError("Gemma engine not loaded — call load() first")

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

        # Gemma has no system role — prepend instructions to the user message
        messages = [
            {"role": "user", "content": f"{system}\n\nTranscript:\n{transcript}"},
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
            raise RuntimeError("Gemma engine not loaded — call load() first")

        loop = asyncio.get_running_loop()

        system = SYSTEM_PROMPT
        if template:
            system += f"\n\nAdditional formatting instructions: {template}"

        messages = [
            {"role": "user", "content": f"{system}\n\nTranscript:\n{transcript}"},
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
        logger.info("Gemma model unloaded")
