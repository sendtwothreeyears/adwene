CREATE TABLE IF NOT EXISTS Attachment (
    id            TEXT PRIMARY KEY NOT NULL,
    sessionId     TEXT NOT NULL,
    fileName      TEXT NOT NULL,
    fileSize      INTEGER NOT NULL DEFAULT 0,
    mimeType      TEXT NOT NULL DEFAULT 'application/octet-stream',
    extractedText TEXT,
    filePath      TEXT NOT NULL,
    createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sessionId) REFERENCES Session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachment_session ON Attachment(sessionId);
