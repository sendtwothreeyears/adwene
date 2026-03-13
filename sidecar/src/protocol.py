"""WebSocket message protocol for the Adwene sidecar.

Client -> Sidecar (text):
    {"type": "transcribe_start", "session_id": "<uuid>"}
    {"type": "transcribe_stop",  "session_id": "<uuid>"}
    {"type": "generate_note", "session_id": "<uuid>", "transcript": "...", "template": "..."}

Client -> Sidecar (binary):
    Raw PCM Int16 audio frames (16 kHz, mono, 500 ms = 16 000 bytes)

Sidecar -> Client (text):
    {"type": "transcript",     "session_id": "<uuid>", "text": "...", "is_final": true}
    {"type": "note_chunk",     "session_id": "<uuid>", "text": "..."}
    {"type": "note",           "session_id": "<uuid>", "content": "...", "is_final": true}
    {"type": "note_progress",  "session_id": "<uuid>", "status": "generating"}
    {"type": "status",         "engine": "...", "status": "loading"|"ready"|"error", "message": "..."}
    {"type": "error",          "message": "..."}
"""

# -- Inbound message types --
TRANSCRIBE_START = "transcribe_start"
TRANSCRIBE_STOP = "transcribe_stop"
GENERATE_NOTE = "generate_note"

# -- Outbound message types --
TRANSCRIPT = "transcript"
NOTE = "note"
NOTE_CHUNK = "note_chunk"
NOTE_PROGRESS = "note_progress"
STATUS = "status"
ERROR = "error"

# -- Engine status values --
STATUS_LOADING = "loading"
STATUS_READY = "ready"
STATUS_ERROR = "error"
