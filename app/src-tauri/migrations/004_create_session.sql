CREATE TABLE IF NOT EXISTS Session (
    id         TEXT PRIMARY KEY NOT NULL,
    transcript TEXT,
    notes      TEXT,
    summary    TEXT,
    context    TEXT,
    status     TEXT NOT NULL DEFAULT 'DRAFT',
    preview    TEXT,
    createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt  TEXT NOT NULL DEFAULT (datetime('now')),

    providerId TEXT NOT NULL,
    patientId  TEXT,
    templateId TEXT,
    FOREIGN KEY (providerId) REFERENCES Provider(id),
    FOREIGN KEY (patientId)  REFERENCES Patient(id) ON DELETE CASCADE,
    FOREIGN KEY (templateId) REFERENCES Template(id)
);

CREATE INDEX IF NOT EXISTS idx_session_provider_created ON Session(providerId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_session_patient ON Session(patientId);
CREATE INDEX IF NOT EXISTS idx_session_status ON Session(status);
