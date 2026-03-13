"""WebSocket server for the Adwene sidecar — routes audio to ASR engine."""

import asyncio
import json
import logging

import websockets

from . import config, protocol
from .engines.registry import create_asr_engine, create_note_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("adwene-sidecar")

# Global engine instances — loaded once at startup.
_asr_engine = None
_note_engine = None

# Set once both engines are loaded; handler awaits this before processing.
_engines_ready = asyncio.Event()

# Connected clients — used for broadcasting status updates.
_clients: set = set()

# Per-connection audio buffers, keyed by session_id.
_audio_buffers: dict[str, bytearray] = {}


async def _send_json(ws, payload: dict) -> None:
    await ws.send(json.dumps(payload))


async def _broadcast(payload: dict) -> None:
    """Send a message to all connected clients."""
    msg = json.dumps(payload)
    for ws in list(_clients):
        try:
            await ws.send(msg)
        except websockets.exceptions.ConnectionClosed:
            pass


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
            # --- Binary frame: append PCM audio to active session buffer ---
            if isinstance(message, bytes):
                if session_id and session_id in _audio_buffers:
                    _audio_buffers[session_id].extend(message)
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
                if session_id in _audio_buffers:
                    logger.warning(
                        "Overwriting existing buffer for session %s", session_id
                    )
                _audio_buffers[session_id] = bytearray()
                logger.info("Transcription started for session %s", session_id)

            elif msg_type == protocol.TRANSCRIBE_STOP:
                sid = data.get("session_id", session_id)
                buf = _audio_buffers.pop(sid, None)
                if buf is None or len(buf) == 0:
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": f"No audio data for session {sid}",
                    })
                    continue

                logger.info(
                    "Transcription stop for session %s — %d bytes of audio",
                    sid, len(buf),
                )

                # Wait for engines if they're still loading
                if not _engines_ready.is_set():
                    logger.info("Waiting for engines to finish loading…")
                    await _engines_ready.wait()

                try:
                    text = await _asr_engine.transcribe(bytes(buf))
                    await _send_json(websocket, {
                        "type": protocol.TRANSCRIPT,
                        "session_id": sid,
                        "text": text,
                        "is_final": True,
                    })
                except Exception as exc:
                    logger.exception("Transcription failed for session %s", sid)
                    await _send_json(websocket, {
                        "type": protocol.ERROR,
                        "message": str(exc),
                    })

                session_id = None

            elif msg_type == protocol.GENERATE_NOTE:
                sid = data.get("session_id")
                transcript = data.get("transcript", "")
                template = data.get("template", "")

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
                        transcript, template
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

            else:
                await websocket.send(message)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        _clients.discard(websocket)
        # Clean up any orphaned buffer
        if session_id and session_id in _audio_buffers:
            del _audio_buffers[session_id]
        logger.info("Client disconnected: %s", remote)


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
