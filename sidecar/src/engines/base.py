"""Abstract base classes for sidecar engines."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class ASREngine(ABC):
    """Abstract base for speech-to-text engines (e.g., MedASR)."""

    @abstractmethod
    async def load(self) -> None:
        """Load the model into memory."""

    @abstractmethod
    async def transcribe(self, audio_chunk: bytes) -> str:
        """Transcribe a chunk of PCM audio and return text."""

    @abstractmethod
    async def unload(self) -> None:
        """Release model resources."""


class NoteEngine(ABC):
    """Abstract base for note generation engines (e.g., MedGemma-4B)."""

    @abstractmethod
    async def load(self) -> None:
        """Load the model into memory."""

    @abstractmethod
    async def generate(self, transcript: str, template: str, context: str = "") -> str:
        """Generate a clinical note from a transcript, template, and context."""

    async def generate_stream(
        self, transcript: str, template: str, context: str = ""
    ) -> AsyncIterator[str]:
        """Yield text chunks as they are generated.

        Default implementation falls back to generate() and yields the full
        result as a single chunk.  Subclasses should override for real
        token-by-token streaming.
        """
        text = await self.generate(transcript, template, context)
        yield text

    async def generate_title(self, transcript: str) -> str:
        """Generate a short (up to 5 word) session title from a transcript.

        Default implementation calls generate() with the title prompt as
        template. Subclasses may override for a more efficient implementation.
        """
        from ..prompts import TITLE_PROMPT

        return await self.generate(transcript, TITLE_PROMPT)

    @abstractmethod
    async def unload(self) -> None:
        """Release model resources."""
