"""WebSocket message protocol for the KasaMD sidecar.

Client -> Sidecar (text):
    {"type": "transcribe_start", "session_id": "<uuid>"}
    {"type": "transcribe_stop",  "session_id": "<uuid>"}
    {"type": "generate_note", "session_id": "<uuid>", "transcript": "...", "template": "...", "context": "..."}
    {"type": "generate_title", "session_id": "<uuid>", "transcript": "..."}
    {"type": "extract_text", "request_id": "<uuid>", "file_path": "..."}
    {"type": "generate_pdf", "request_id": "<uuid>", "html": "...", "provider": {...}, "session_title": "..."}
    {"type": "dictate_start", "session_id": "<uuid>"}
    {"type": "dictate_stop",  "session_id": "<uuid>"}

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
    {"type": "pdf_ready",      "request_id": "<uuid>", "data": "<base64>"}
    {"type": "pdf_error",      "request_id": "<uuid>", "error": "..."}
    {"type": "dictate_result",  "session_id": "<uuid>", "text": "..."}
    {"type": "dictate_error",   "session_id": "<uuid>", "error": "..."}
    {"type": "error",          "message": "..."}
"""

# -- Inbound message types --
TRANSCRIBE_START = "transcribe_start"
TRANSCRIBE_STOP = "transcribe_stop"
GENERATE_NOTE = "generate_note"
GENERATE_TITLE = "generate_title"
EXTRACT_TEXT = "extract_text"
GENERATE_PDF = "generate_pdf"

# -- Inbound: dictation --
DICTATE_START = "dictate_start"
DICTATE_STOP = "dictate_stop"

# -- Outbound message types --
TRANSCRIPT = "transcript"
TRANSCRIPT_SEGMENT = "transcript_segment"
TRANSCRIPT_PARTIAL = "transcript_partial"
TRANSCRIPT_FINAL = "transcript_final"
TRANSCRIPT_REFINING = "transcript_refining"
TRANSCRIPT_REFINED = "transcript_refined"
NOTE = "note"
NOTE_CHUNK = "note_chunk"
NOTE_PROGRESS = "note_progress"
TITLE = "title"
TEXT_EXTRACTED = "text_extracted"
PDF_READY = "pdf_ready"
PDF_ERROR = "pdf_error"
DICTATE_RESULT = "dictate_result"
DICTATE_ERROR = "dictate_error"
STATUS = "status"
ERROR = "error"

# -- Engine status values --
STATUS_LOADING = "loading"
STATUS_READY = "ready"
STATUS_ERROR = "error"
