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
    async def generate(self, transcript: str, template: str) -> str:
        """Generate a clinical note from a transcript and template."""

    async def generate_stream(
        self, transcript: str, template: str
    ) -> AsyncIterator[str]:
        """Yield text chunks as they are generated.

        Default implementation falls back to generate() and yields the full
        result as a single chunk.  Subclasses should override for real
        token-by-token streaming.
        """
        text = await self.generate(transcript, template)
        yield text

    @abstractmethod
    async def unload(self) -> None:
        """Release model resources."""
