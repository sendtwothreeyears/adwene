"""Tests for dual transcript logging (KAS-282)."""

import json
import os
import tempfile

from unittest.mock import patch

from sidecar.src.transcript_logger import log_transcripts


class TestTranscriptLogger:
    """Test the JSONL transcript logger."""

    def test_writes_jsonl_record(self, tmp_path):
        """Should write a valid JSONL record to the log file."""
        with patch("sidecar.src.transcript_logger.config") as mock_config:
            mock_config.TRANSCRIPT_LOG_ENABLED = True
            mock_config.TRANSCRIPT_LOG_DIR = str(tmp_path)

            log_transcripts(
                session_id="sess-1",
                segment_text="hello world",
                full_audio_text="hello beautiful world",
                selected="full_audio",
                reason="full_audio_wins",
                edit_ratio=0.15,
                logit_score=-123.4,
                lm_score=-56.7,
                audio_duration_s=30.5,
                encode_time_s=5.2,
                decode_time_s=1.3,
            )

        log_file = tmp_path / "transcripts.jsonl"
        assert log_file.exists()

        with open(log_file) as f:
            lines = f.readlines()
        assert len(lines) == 1

        record = json.loads(lines[0])
        assert record["session_id"] == "sess-1"
        assert record["segment_text"] == "hello world"
        assert record["full_audio_text"] == "hello beautiful world"
        assert record["selected"] == "full_audio"
        assert record["reason"] == "full_audio_wins"
        assert record["edit_ratio"] == 0.15
        assert record["logit_score"] == -123.4
        assert record["lm_score"] == -56.7
        assert record["audio_duration_s"] == 30.5
        assert record["encode_time_s"] == 5.2
        assert record["decode_time_s"] == 1.3
        assert "timestamp" in record

    def test_appends_multiple_records(self, tmp_path):
        """Should append records, not overwrite."""
        with patch("sidecar.src.transcript_logger.config") as mock_config:
            mock_config.TRANSCRIPT_LOG_ENABLED = True
            mock_config.TRANSCRIPT_LOG_DIR = str(tmp_path)

            for i in range(3):
                log_transcripts(
                    session_id=f"sess-{i}",
                    segment_text="seg",
                    full_audio_text="full",
                    selected="full_audio",
                    reason="agree",
                    edit_ratio=0.01,
                    logit_score=-100.0,
                    lm_score=-50.0,
                    audio_duration_s=10.0,
                    encode_time_s=2.0,
                    decode_time_s=1.0,
                )

        log_file = tmp_path / "transcripts.jsonl"
        with open(log_file) as f:
            lines = f.readlines()
        assert len(lines) == 3

    def test_disabled_does_not_write(self, tmp_path):
        """When disabled, no file should be created."""
        with patch("sidecar.src.transcript_logger.config") as mock_config:
            mock_config.TRANSCRIPT_LOG_ENABLED = False
            mock_config.TRANSCRIPT_LOG_DIR = str(tmp_path)

            log_transcripts(
                session_id="sess-1",
                segment_text="seg",
                full_audio_text="full",
                selected="full_audio",
                reason="agree",
                edit_ratio=0.01,
                logit_score=-100.0,
                lm_score=-50.0,
                audio_duration_s=10.0,
                encode_time_s=2.0,
                decode_time_s=1.0,
            )

        log_file = tmp_path / "transcripts.jsonl"
        assert not log_file.exists()

    def test_creates_directory_if_missing(self, tmp_path):
        """Should create the log directory if it doesn't exist."""
        log_dir = tmp_path / "nested" / "log" / "dir"

        with patch("sidecar.src.transcript_logger.config") as mock_config:
            mock_config.TRANSCRIPT_LOG_ENABLED = True
            mock_config.TRANSCRIPT_LOG_DIR = str(log_dir)

            log_transcripts(
                session_id="sess-1",
                segment_text="seg",
                full_audio_text="full",
                selected="full_audio",
                reason="agree",
                edit_ratio=0.01,
                logit_score=-100.0,
                lm_score=-50.0,
                audio_duration_s=10.0,
                encode_time_s=2.0,
                decode_time_s=1.0,
            )

        assert (log_dir / "transcripts.jsonl").exists()

    def test_handles_unicode(self, tmp_path):
        """Should handle Unicode text (medical terms, accented chars)."""
        with patch("sidecar.src.transcript_logger.config") as mock_config:
            mock_config.TRANSCRIPT_LOG_ENABLED = True
            mock_config.TRANSCRIPT_LOG_DIR = str(tmp_path)

            log_transcripts(
                session_id="sess-1",
                segment_text="température: 38°C",
                full_audio_text="température: 38.5°C",
                selected="full_audio",
                reason="full_audio_wins",
                edit_ratio=0.1,
                logit_score=-100.0,
                lm_score=-50.0,
                audio_duration_s=10.0,
                encode_time_s=2.0,
                decode_time_s=1.0,
            )

        log_file = tmp_path / "transcripts.jsonl"
        record = json.loads(log_file.read_text(encoding="utf-8"))
        assert "°C" in record["full_audio_text"]
