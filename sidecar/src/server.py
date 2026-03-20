"""WebSocket server for the KasaMD sidecar — routes audio to ASR engine.

Supports two transcription modes:
- **Streaming (live):** Audio chunks flow through Silero VAD. Each detected
  utterance is transcribed immediately and sent as a `transcript_segment`.
  On stop, a batch transcription of the full audio produces a `transcript_final`.
- **Batch (legacy):** Full audio is transcribed on stop only (kept as fallback).
"""

import asyncio
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import numpy as np
import websockets

from . import config, protocol
from .engines.registry import create_asr_engine, create_note_engine
from .pdf_generator import generate_pdf
from .text_extraction import extract_text
from .vad import SileroVAD

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("kasamd-sidecar")

# Global engine instances — loaded once at startup.
_asr_engine = None
_note_engine = None

# Single-thread executor for all MLX operations. MLX Metal GPU calls are NOT
# thread-safe — concurrent calls from the default ThreadPoolExecutor cause
# corruption/crashes. This ensures only one MLX inference runs at a time.
_mlx_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mlx")

# Set once both engines are loaded; handler awaits this before processing.
_engines_ready = asyncio.Event()

# Connected clients — used for broadcasting status updates.
_clients: set = set()

# -- Streaming session state --

# Bytes of audio without a VAD segment before triggering fallback batch.
_FALLBACK_SILENCE_BYTES = 5 * 16_000 * 2  # 5 seconds at 16kHz 16-bit mono

# Max full_audio buffer size.  Configured via MAX_AUDIO_BUFFER_MB (default
# 60 MB ≈ 30 min at 16 kHz 16-bit mono).  The buffer is retained after
# recording stops so the async re-transcription pass can use it.
_MAX_FULL_AUDIO_BYTES = int(config.MAX_AUDIO_BUFFER_MB * 1024 * 1024)

# Emit partial transcriptions every N ms while speech is ongoing.
_PARTIAL_INTERVAL_MS = 500

# Max audio (ms) fed to a partial transcription. Partials are interim results
# so full-utterance context isn't needed. Capping this prevents O(duration)
# feature extraction that would otherwise degrade as speech gets longer.
_PARTIAL_MAX_AUDIO_MS = 10_000  # 10 seconds



@dataclass
class _StreamingSession:
    """Per-session state for live streaming transcription."""

    vad: SileroVAD = field(default_factory=SileroVAD)
    full_audio: bytearray = field(default_factory=bytearray)
    segment_texts: list[str] = field(default_factory=list)  # accumulated segment transcripts
    segment_counter: int = 0
    bytes_since_last_segment: int = 0
    last_segment_time: float = field(default_factory=time.monotonic)
    last_partial_time: float = field(default_factory=time.monotonic)
    last_partial_speech_len: int = 0  # speech buffer size at last partial
    partial_task: asyncio.Task | None = None
    segment_generation: int = 0  # bumped on each segment emit
    last_partial_text: str = ""  # reuse as segment text to avoid re-transcription


# Active streaming sessions, keyed by session_id.
_sessions: dict[str, _StreamingSession] = {}

# Cooperative cancellation flags for background re-transcription tasks.
# When a new recording starts for the same session_id, the flag is set
# so the in-flight retranscription aborts between encoder chunks.
_retranscribe_cancel: dict[str, bool] = {}

# In-flight retranscription tasks, keyed by session_id.
_retranscribe_tasks: dict[str, asyncio.Task] = {}


async def _send_json(ws, payload: dict) -> None:
    await ws.send(json.dumps(payload))


async def _broadcast(payload: dict) -> None:
    """Send a message to all connected clients."""
    msg = json.dumps(payload)
    closed = []
    for ws in list(_clients):
        try:
            await ws.send(msg)
        except websockets.exceptions.ConnectionClosed:
            closed.append(ws)
    for ws in closed:
        _clients.discard(ws)


# ---------------------------------------------------------------------------
# Full-audio re-transcription (KAS-278)
# ---------------------------------------------------------------------------

async def _retranscribe(
    ws,
    session_id: str,
    audio_bytes: bytes,
    segment_text: str,
) -> None:
    """Re-transcribe the full audio asynchronously for higher quality.

    Runs chunked encoder inference on the full recording, then a single
    beam-search decode pass over concatenated logits.  Emits
    ``transcript_refining`` at start and ``transcript_refined`` on
    completion.  Respects cooperative cancellation via
    ``_retranscribe_cancel[session_id]``.
    """
    from .engines.medasr_mlx_engine import (
        SAMPLE_RATE,
        _extract_features_chunked,
    )

    try:
        # Notify client that refinement is in progress.
        await _send_json(ws, {
            "type": protocol.TRANSCRIPT_REFINING,
            "session_id": session_id,
        })

        # Convert Int16 PCM bytes → float32 samples.
        pcm = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float = pcm.astype(np.float32) / 32768.0

        if len(audio_float) < 2_240:
            logger.warning("Retranscribe: audio too short (%d samples), skipping", len(audio_float))
            return

        loop = asyncio.get_running_loop()
        engine = _asr_engine

        # --- Chunked encoder pass ---
        chunk_duration = 20.0
        chunk_samples = int(chunk_duration * SAMPLE_RATE)
        hop_length = 160
        win_length = 400
        n_total_frames = 1 + (len(audio_float) - win_length) // hop_length
        frames_per_chunk = max(1, chunk_samples // hop_length)

        logprob_parts: list[np.ndarray] = []
        f_start = 0

        t0 = time.perf_counter()

        while f_start < n_total_frames:
            # Check cooperative cancellation between chunks.
            if _retranscribe_cancel.get(session_id, False):
                logger.info("Retranscribe cancelled for session %s", session_id)
                return

            f_end = min(f_start + frames_per_chunk, n_total_frames)
            audio_start = f_start * hop_length
            audio_end = (f_end - 1) * hop_length + win_length
            chunk_audio = audio_float[audio_start:audio_end]

            # Run encoder on this chunk via the MLX executor.
            logprobs = await loop.run_in_executor(
                _mlx_executor, engine._encode_chunk_sync, chunk_audio,
            )
            logprob_parts.append(logprobs)
            f_start = f_end

        # Check cancellation before the (potentially expensive) decode.
        if _retranscribe_cancel.get(session_id, False):
            logger.info("Retranscribe cancelled for session %s", session_id)
            return

        # --- Concatenated decoder pass ---
        all_logprobs = np.concatenate(logprob_parts, axis=0)
        t_encode = time.perf_counter() - t0

        t1 = time.perf_counter()
        refined_text, logit_score, lm_score = await loop.run_in_executor(
            None,  # CPU-only decode, no need for MLX executor
            engine.decode_logprobs,
            all_logprobs,
            100,  # beam_width for retranscription
        )
        t_decode = time.perf_counter() - t1

        logger.info(
            "Retranscribe for %s: encode=%.1fs, decode=%.1fs, "
            "audio=%.1fs, frames=%d, logit_score=%.2f, lm_score=%.2f",
            session_id, t_encode, t_decode,
            len(audio_float) / SAMPLE_RATE, n_total_frames,
            logit_score, lm_score,
        )

        # --- Quality gate ---
        from .quality_gate import select_transcript

        gate = select_transcript(segment_text, refined_text)
        logger.info(
            "Quality gate for %s: selected=%s, reason=%s, edit_ratio=%.3f",
            session_id, gate.selected, gate.reason, gate.edit_ratio,
        )

        # --- Emit result ---
        await _send_json(ws, {
            "type": protocol.TRANSCRIPT_REFINED,
            "session_id": session_id,
            "text": gate.text,
            "segment_text": segment_text,
            "selected": gate.selected,
            "reason": gate.reason,
            "edit_ratio": gate.edit_ratio,
            "logit_score": logit_score,
            "lm_score": lm_score,
        })

    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected during retranscribe for %s", session_id)
    except Exception:
        logger.exception("Retranscribe failed for session %s", session_id)
    finally:
        _retranscribe_cancel.pop(session_id, None)
        _retranscribe_tasks.pop(session_id, None)


async def handler(websocket):
    remote = websocket.remote_address
    logger.info("Client connected: %s", remote)
    _clients.add(websocket)
    session_id = None

    # Tell the new client the current engine status immediately.
    if _engines_ready.is_set():
        await _send_json(websocket, {
            "type": protocol.STATUS,
            "engine": "all",
            "status": protocol.STATUS_READY,
            "message": "Engines ready",
        })
    else:
        await _send_json(websocket, {
            "type": protocol.STATUS,
            "engine": "all",
            "status": protocol.STATUS_LOADING,
            "message": "Models are loading…",
        })

    try:
        async for message in websocket:
            # --- Binary frame: feed to VAD + accumulate for batch ---
            if isinstance(message, bytes):
                if session_id and session_id in _sessions:
                    sess = _sessions[session_id]
                    # Accumulate for final batch reconciliation (capped)
                    sess.full_audio.extend(message)
                    if len(sess.full_audio) > _MAX_FULL_AUDIO_BYTES:
                        excess = len(sess.full_audio) - _MAX_FULL_AUDIO_BYTES
                        del sess.full_audio[:excess]
                    sess.bytes_since_last_segment += len(message)

                    # Feed to VAD — returns completed utterances
                    utterances = sess.vad.process_chunk(message)

                    for utterance_pcm in utterances:
                        # Cancel any in-flight partial — segment takes priority
                        if sess.partial_task and not sess.partial_task.done():
                            sess.partial_task.cancel()
                            try:
                                await sess.partial_task
                            except (asyncio.CancelledError, Exception):
                                pass
                            sess.partial_task = None

                        dur_ms = len(utterance_pcm) / (16_000 * 2) * 1000
                        logger.info(
                            "VAD segment emitted: %.0fms for session %s",
                            dur_ms, session_id,
                        )
                        sess.bytes_since_last_segment = 0
                        sess.last_segment_time = time.monotonic()
                        sess.last_partial_speech_len = 0
                        sess.segment_generation += 1
                        await _transcribe_segment(
                            websocket, session_id, sess, utterance_pcm
                        )

                    # Launch non-blocking partial transcript while speech ongoing
                    if not utterances:
                        _maybe_launch_partial(
                            websocket, session_id, sess
                        )

                    # Graceful degradation: if no segments for >5s of audio,
                    # do a fallback batch transcription of recent audio
                    if sess.bytes_since_last_segment >= _FALLBACK_SILENCE_BYTES:
                        # Cancel any in-flight partial to avoid concurrent MLX calls
                        if sess.partial_task and not sess.partial_task.done():
                            sess.partial_task.cancel()
                            try:
                                await sess.partial_task
                            except (asyncio.CancelledError, Exception):
                                pass
                            sess.partial_task = None
                        sess.segment_generation += 1  # invalidate in-flight partial
                        # Clear partial text — fallback must transcribe its own
                        # audio, not reuse stale partial text from VAD buffer
                        sess.last_partial_text = ""
                        logger.info(
                            "No VAD segments for %.1fs — fallback batch for session %s",
                            sess.bytes_since_last_segment / (16_000 * 2),
                            session_id,
                        )
                        await _transcribe_segment(
                            websocket,
                            session_id,
                            sess,
                            bytes(sess.full_audio[-sess.bytes_since_last_segment:]),
                        )
                        sess.bytes_since_last_segment = 0
                        sess.last_segment_time = time.monotonic()
                        # Clear VAD speech buffer so next partial starts fresh,
                        # but preserve LSTM state so VAD can continue detecting
                        # speech without a re-convergence gap.
                        sess.vad.clear_speech_buffer()
                        sess.last_partial_speech_len = 0
                else:
                    logger.warning("Binary frame received with no active session")
                continue

            # --- Text frame: parse JSON command ---
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                await _send_json(websocket, {
                    "type": protocol.ERROR,
                    "message": "Invalid JSON",
                })
                continue

            msg_type = data.get("type")

            if msg_type == protocol.TRANSCRIBE_START:
                session_id = data.get("session_id")
                if not session_id:
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": "transcribe_start requires session_id",
                    })
                    continue
                # Cancel any in-flight retranscription for this session.
                if session_id in _retranscribe_tasks:
                    _retranscribe_cancel[session_id] = True
                    old_rt = _retranscribe_tasks.pop(session_id, None)
                    if old_rt and not old_rt.done():
                        old_rt.cancel()

                if session_id in _sessions:
                    old = _sessions[session_id]
                    if old.partial_task and not old.partial_task.done():
                        old.partial_task.cancel()
                        try:
                            await old.partial_task
                        except (asyncio.CancelledError, Exception):
                            pass
                    old.full_audio.clear()
                    old.vad = None  # type: ignore[assignment]
                    logger.warning(
                        "Overwriting existing session for %s", session_id
                    )
                _sessions[session_id] = _StreamingSession()
                logger.info("Streaming transcription started for session %s", session_id)

            elif msg_type == protocol.TRANSCRIBE_STOP:
                sid = data.get("session_id", session_id)
                sess = _sessions.pop(sid, None)
                if sess is None or len(sess.full_audio) == 0:
                    logger.warning("No audio data for session %s — sending empty transcript", sid)
                    await _send_json(websocket, {
                        "type": protocol.TRANSCRIPT_FINAL,
                        "session_id": sid,
                        "text": "",
                        "is_final": True,
                    })
                    continue

                # Cancel any in-flight partial before final processing
                if sess.partial_task and not sess.partial_task.done():
                    sess.partial_task.cancel()
                    try:
                        await sess.partial_task
                    except (asyncio.CancelledError, Exception):
                        pass
                    sess.partial_task = None

                logger.info(
                    "Transcription stop for session %s — %d bytes, %d segments",
                    sid, len(sess.full_audio), sess.segment_counter,
                )

                # Flush any in-progress VAD utterance
                trailing = sess.vad.flush()
                if trailing:
                    await _transcribe_segment(websocket, sid, sess, trailing)

                # Wait for engines if they're still loading
                if not _engines_ready.is_set():
                    logger.info("Waiting for engines to finish loading…")
                    await _engines_ready.wait()

                # Build final transcript from accumulated segments.
                # Segments were already transcribed with beam search during
                # streaming, so concatenation gives a fast initial result.
                final_text = " ".join(sess.segment_texts)
                sess.segment_texts.clear()

                await _send_json(websocket, {
                    "type": protocol.TRANSCRIPT_FINAL,
                    "session_id": sid,
                    "text": final_text,
                    "is_final": True,
                })

                # Kick off async full-audio re-transcription for higher
                # quality. Copy the audio buffer before clearing.
                audio_snapshot = bytes(sess.full_audio)
                sess.full_audio.clear()

                if len(audio_snapshot) > 0:
                    # Cancel any previous retranscription for this session.
                    _retranscribe_cancel[sid] = True
                    old_task = _retranscribe_tasks.pop(sid, None)
                    if old_task and not old_task.done():
                        old_task.cancel()
                        try:
                            await old_task
                        except (asyncio.CancelledError, Exception):
                            pass

                    _retranscribe_cancel[sid] = False
                    task = asyncio.create_task(
                        _retranscribe(websocket, sid, audio_snapshot, final_text),
                    )
                    _retranscribe_tasks[sid] = task

                session_id = None

            elif msg_type == protocol.GENERATE_NOTE:
                sid = data.get("session_id")
                transcript = data.get("transcript", "")
                template = data.get("template", "")
                context = data.get("context", "")

                if not sid or not transcript:
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": "generate_note requires session_id and transcript",
                    })
                    continue

                logger.info("Note generation started for session %s", sid)

                # Wait for engines if they're still loading
                if not _engines_ready.is_set():
                    logger.info("Waiting for engines to finish loading…")
                    await _engines_ready.wait()

                await _send_json(websocket, {
                    "type": protocol.NOTE_PROGRESS,
                    "session_id": sid,
                    "status": "generating",
                })

                try:
                    full_text = ""
                    async for chunk in _note_engine.generate_stream(
                        transcript, template, context
                    ):
                        full_text += chunk
                        await _send_json(websocket, {
                            "type": protocol.NOTE_CHUNK,
                            "session_id": sid,
                            "text": chunk,
                        })

                    await _send_json(websocket, {
                        "type": protocol.NOTE,
                        "session_id": sid,
                        "content": full_text,
                        "is_final": True,
                    })
                    logger.info("Note generated for session %s", sid)
                except Exception as exc:
                    logger.exception("Note generation failed for session %s", sid)
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": str(exc),
                    })

            elif msg_type == protocol.GENERATE_TITLE:
                sid = data.get("session_id")
                transcript = data.get("transcript", "")

                if not sid or not transcript:
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": "generate_title requires session_id and transcript",
                    })
                    continue

                logger.info("Title generation started for session %s", sid)

                if not _engines_ready.is_set():
                    logger.info("Waiting for engines to finish loading…")
                    await _engines_ready.wait()

                try:
                    title = await _note_engine.generate_title(transcript)
                    # Strip whitespace and truncate to ~5 words
                    title = " ".join(title.strip().split()[:5])
                    await _send_json(websocket, {
                        "type": protocol.TITLE,
                        "session_id": sid,
                        "title": title,
                    })
                    logger.info("Title generated for session %s: %s", sid, title)
                except Exception as exc:
                    logger.exception("Title generation failed for session %s", sid)
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": str(exc),
                    })

            elif msg_type == protocol.EXTRACT_TEXT:
                request_id = data.get("request_id", "")
                file_path = data.get("file_path", "")

                if not file_path:
                    await _send_json(websocket, {
                        "type": protocol.TEXT_EXTRACTED,
                        "request_id": request_id,
                        "text": "",
                        "error": "file_path is required",
                    })
                    continue

                try:
                    loop = asyncio.get_running_loop()
                    text = await loop.run_in_executor(
                        None, extract_text, file_path
                    )
                    await _send_json(websocket, {
                        "type": protocol.TEXT_EXTRACTED,
                        "request_id": request_id,
                        "text": text,
                        "error": None,
                    })
                except Exception as exc:
                    logger.exception("Text extraction failed for %s", file_path)
                    await _send_json(websocket, {
                        "type": protocol.TEXT_EXTRACTED,
                        "request_id": request_id,
                        "text": "",
                        "error": str(exc),
                    })

            elif msg_type == protocol.GENERATE_PDF:
                request_id = data.get("request_id", "")
                html = data.get("html", "")
                provider = data.get("provider") or {}
                session_title = data.get("session_title")

                if not html:
                    await _send_json(websocket, {
                        "type": protocol.PDF_ERROR,
                        "request_id": request_id,
                        "error": "html is required",
                    })
                    continue

                try:
                    loop = asyncio.get_running_loop()
                    pdf_bytes = await loop.run_in_executor(
                        None, generate_pdf, html, provider, session_title
                    )
                    import base64 as _b64
                    pdf_b64 = _b64.b64encode(pdf_bytes).decode("ascii")
                    await _send_json(websocket, {
                        "type": protocol.PDF_READY,
                        "request_id": request_id,
                        "data": pdf_b64,
                    })
                except Exception as exc:
                    logger.exception("PDF generation failed")
                    await _send_json(websocket, {
                        "type": protocol.PDF_ERROR,
                        "request_id": request_id,
                        "error": str(exc),
                    })

            else:
                await websocket.send(message)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        _clients.discard(websocket)
        # Clean up any orphaned session
        if session_id and session_id in _sessions:
            sess = _sessions.pop(session_id)
            if sess.partial_task and not sess.partial_task.done():
                sess.partial_task.cancel()
                try:
                    await sess.partial_task
                except (asyncio.CancelledError, Exception):
                    pass
            # Release VAD ONNX session
            sess.vad = None  # type: ignore[assignment]
            sess.full_audio.clear()
        logger.info("Client disconnected: %s", remote)


def _maybe_launch_partial(
    ws, session_id: str, sess: _StreamingSession
) -> None:
    """Launch a non-blocking partial transcription if conditions are met.

    Fires as a background task so the audio processing loop is never stalled.
    Only one partial runs at a time per session — if the previous is still
    in-flight, this call is a no-op.
    """
    if not _engines_ready.is_set():
        return

    # One partial at a time — skip if previous is still running
    if sess.partial_task and not sess.partial_task.done():
        return

    now = time.monotonic()
    elapsed_ms = (now - sess.last_partial_time) * 1000
    if elapsed_ms < _PARTIAL_INTERVAL_MS:
        return

    speech_pcm = sess.vad.peek_speech(max_tail_ms=_PARTIAL_MAX_AUDIO_MS)
    if speech_pcm is None:
        return

    # Only transcribe if we have new audio since last partial
    if len(speech_pcm) <= sess.last_partial_speech_len:
        return

    # Snapshot the generation counter to detect stale results
    gen = sess.segment_generation

    async def _do_partial():
        try:
            text = await _asr_engine.transcribe(speech_pcm)
            # Discard if a segment was emitted while we were transcribing
            if sess.segment_generation != gen:
                return
            if text.strip():
                sess.last_partial_time = time.monotonic()
                sess.last_partial_speech_len = len(speech_pcm)
                sess.last_partial_text = text
                await _send_json(ws, {
                    "type": protocol.TRANSCRIPT_PARTIAL,
                    "session_id": session_id,
                    "text": text,
                    "segment_index": sess.segment_counter,
                })
        except asyncio.CancelledError:
            pass  # segment took priority — expected
        except Exception:
            logger.exception(
                "Partial transcription failed for session %s", session_id
            )

    sess.partial_task = asyncio.create_task(_do_partial())


async def _transcribe_segment(
    ws, session_id: str, sess: _StreamingSession, utterance_pcm: bytes
) -> None:
    """Transcribe a single VAD utterance and send as transcript_segment.

    If a partial transcription already covered this speech window, reuse
    that text instead of re-transcribing — it had full acoustic context
    and produces more coherent output.
    """
    if not _engines_ready.is_set():
        return  # Skip segments while engines are loading

    try:
        # Prefer the last partial's text if available — it was transcribed
        # from the full speech buffer and has better context than re-transcribing
        # just the utterance audio.
        if sess.last_partial_text:
            text = sess.last_partial_text
            sess.last_partial_text = ""
        else:
            text = await _asr_engine.transcribe(utterance_pcm)

        if text.strip():
            idx = sess.segment_counter
            sess.segment_counter += 1
            sess.segment_texts.append(text)
            await _send_json(ws, {
                "type": protocol.TRANSCRIPT_SEGMENT,
                "session_id": session_id,
                "text": text,
                "segment_index": idx,
                "is_final": False,
            })
    except Exception as exc:
        logger.exception(
            "Segment transcription failed for session %s (segment %d)",
            session_id,
            sess.segment_counter,
        )



async def _load_engines() -> None:
    """Load ASR and note engines in the background."""
    global _asr_engine, _note_engine

    _asr_engine = create_asr_engine(config.ASR_ENGINE)
    logger.info("Loading %s…", config.ASR_ENGINE)
    await _broadcast({
        "type": protocol.STATUS,
        "engine": config.ASR_ENGINE,
        "status": protocol.STATUS_LOADING,
        "message": f"Loading {config.ASR_ENGINE}…",
    })
    try:
        await _asr_engine.load()
        logger.info("%s ready", config.ASR_ENGINE)
    except Exception as exc:
        logger.exception("Failed to load ASR engine")
        await _broadcast({
            "type": protocol.STATUS,
            "engine": config.ASR_ENGINE,
            "status": protocol.STATUS_ERROR,
            "message": str(exc),
        })
        raise

    _note_engine = create_note_engine(config.NOTE_ENGINE)
    logger.info("Loading %s…", config.NOTE_ENGINE)
    await _broadcast({
        "type": protocol.STATUS,
        "engine": config.NOTE_ENGINE,
        "status": protocol.STATUS_LOADING,
        "message": f"Loading {config.NOTE_ENGINE}…",
    })
    try:
        await _note_engine.load()
        logger.info("%s ready", config.NOTE_ENGINE)
    except Exception as exc:
        logger.exception("Failed to load note engine")
        await _broadcast({
            "type": protocol.STATUS,
            "engine": config.NOTE_ENGINE,
            "status": protocol.STATUS_ERROR,
            "message": str(exc),
        })
        raise

    _engines_ready.set()
    await _broadcast({
        "type": protocol.STATUS,
        "engine": "all",
        "status": protocol.STATUS_READY,
        "message": "All engines ready",
    })


async def serve():
    logger.info("Starting sidecar on %s:%s", config.HOST, config.PORT)

    # Start WebSocket server immediately so the frontend can connect,
    # then load engines in the background.
    async with websockets.serve(handler, config.HOST, config.PORT):
        logger.info("WebSocket server listening — loading engines in background…")
        await _load_engines()
        await asyncio.Future()  # run forever


def main():
    asyncio.run(serve())


if __name__ == "__main__":
    main()
