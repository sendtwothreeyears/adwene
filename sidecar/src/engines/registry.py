"""Engine registry — maps config names to engine classes."""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING

from .base import ASREngine, NoteEngine

if TYPE_CHECKING:
    pass

# Lazy imports to avoid loading heavy ML dependencies at module level.
_ASR_ENGINES: dict[str, str] = {
    "medasr": "src.engines.medasr_mlx_engine.MedASRMLXEngine",
}

_NOTE_ENGINES: dict[str, str] = {
    "gemma": "src.engines.gemma_engine.GemmaEngine",
}


def _create_engine(registry: dict[str, str], name: str, kind: str):
    dotpath = registry.get(name)
    if dotpath is None:
        raise ValueError(
            f"Unknown {kind} engine: {name!r}. Available: {list(registry)}"
        )
    module_path, class_name = dotpath.rsplit(".", 1)
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    return cls()


def create_asr_engine(name: str) -> ASREngine:
    """Instantiate an ASR engine by its config name."""
    return _create_engine(_ASR_ENGINES, name, "ASR")


def create_note_engine(name: str) -> NoteEngine:
    """Instantiate a note engine by its config name."""
    return _create_engine(_NOTE_ENGINES, name, "note")
