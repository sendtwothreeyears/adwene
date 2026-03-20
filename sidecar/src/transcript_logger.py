"""Structured dual transcript logging (KAS-282).

Logs both the segment-concatenated and full-audio re-transcription
alongside quality-gate metadata in JSONL format.  Enables future
threshold calibration, WER analysis, and fine-tuning dataset construction.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from . import config

logger = logging.getLogger("kasamd-sidecar")


def log_transcripts(
    session_id: str,
    segment_text: str,
    full_audio_text: str,
    selected: str,
    reason: str,
    edit_ratio: float,
    logit_score: float,
    lm_score: float,
    audio_duration_s: float,
    encode_time_s: float,
    decode_time_s: float,
) -> None:
    """Append a transcript comparison record to the JSONL log.

    Each line is a self-contained JSON object with both transcript
    versions, quality-gate decision, and timing metadata.
    """
    if not config.TRANSCRIPT_LOG_ENABLED:
        return

    log_dir = Path(config.TRANSCRIPT_LOG_DIR)
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.warning("Cannot create transcript log dir %s: %s", log_dir, exc)
        return

    record = {
        "timestamp": time.time(),
        "session_id": session_id,
        "segment_text": segment_text,
        "full_audio_text": full_audio_text,
        "selected": selected,
        "reason": reason,
        "edit_ratio": round(edit_ratio, 4),
        "logit_score": round(logit_score, 4),
        "lm_score": round(lm_score, 4),
        "audio_duration_s": round(audio_duration_s, 2),
        "encode_time_s": round(encode_time_s, 2),
        "decode_time_s": round(decode_time_s, 2),
    }

    log_file = log_dir / "transcripts.jsonl"
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:
        logger.warning("Failed to write transcript log: %s", exc)
