CREATE TABLE IF NOT EXISTS SessionNote (
    id            TEXT PRIMARY KEY NOT NULL,
    sessionId     TEXT NOT NULL,
    templateId    TEXT NOT NULL,
    templateName  TEXT NOT NULL,
    content       TEXT,
    createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sessionId)  REFERENCES Session(id) ON DELETE CASCADE,
    FOREIGN KEY (templateId) REFERENCES Template(id)
);

CREATE INDEX IF NOT EXISTS idx_session_note_session ON SessionNote(sessionId);
CREATE INDEX IF NOT EXISTS idx_session_note_session_template ON SessionNote(sessionId, templateId);
