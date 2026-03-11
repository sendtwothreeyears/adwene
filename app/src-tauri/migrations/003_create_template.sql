CREATE TABLE IF NOT EXISTS Template (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    content     TEXT NOT NULL,
    description TEXT,
    isSystem    INTEGER NOT NULL DEFAULT 0,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now')),

    providerId  TEXT,
    FOREIGN KEY (providerId) REFERENCES Provider(id)
);
