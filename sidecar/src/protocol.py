"""WebSocket message protocol for the KasaMD sidecar.

Client -> Sidecar (text):
    {"type": "transcribe_start", "session_id": "<uuid>"}
    {"type": "transcribe_stop",  "session_id": "<uuid>"}
    {"type": "generate_note", "session_id": "<uuid>", "transcript": "...", "template": "...", "context": "..."}
    {"type": "generate_title", "session_id": "<uuid>", "transcript": "..."}
    {"type": "extract_text", "request_id": "<uuid>", "file_path": "..."}

Client -> Sidecar (binary):
    Raw PCM Int16 audio frames (16 kHz, mono, 100 ms = 3 200 bytes)

Sidecar -> Client (text):
    {"type": "transcript",         "session_id": "<uuid>", "text": "...", "is_final": true}
    {"type": "transcript_segment", "session_id": "<uuid>", "text": "...", "segment_index": N, "is_final": false}
    {"type": "transcript_partial", "session_id": "<uuid>", "text": "...", "segment_index": N}
    {"type": "transcript_final",   "session_id": "<uuid>", "text": "...", "is_final": true}
    {"type": "note_chunk",         "session_id": "<uuid>", "text": "..."}
    {"type": "note",           "session_id": "<uuid>", "content": "...", "is_final": true}
    {"type": "note_progress",  "session_id": "<uuid>", "status": "generating"}
    {"type": "status",         "engine": "...", "status": "loading"|"ready"|"error", "message": "..."}
    {"type": "title",             "session_id": "<uuid>", "title": "..."}
    {"type": "text_extracted",   "request_id": "<uuid>", "text": "...", "error": null}
    {"type": "error",          "message": "..."}
"""

# -- Inbound message types --
TRANSCRIBE_START = "transcribe_start"
TRANSCRIBE_STOP = "transcribe_stop"
GENERATE_NOTE = "generate_note"
GENERATE_TITLE = "generate_title"
EXTRACT_TEXT = "extract_text"

# -- Outbound message types --
TRANSCRIPT = "transcript"
TRANSCRIPT_SEGMENT = "transcript_segment"
TRANSCRIPT_PARTIAL = "transcript_partial"
TRANSCRIPT_FINAL = "transcript_final"
NOTE = "note"
NOTE_CHUNK = "note_chunk"
NOTE_PROGRESS = "note_progress"
TITLE = "title"
TEXT_EXTRACTED = "text_extracted"
STATUS = "status"
ERROR = "error"

# -- Engine status values --
STATUS_LOADING = "loading"
STATUS_READY = "ready"
STATUS_ERROR = "error"
