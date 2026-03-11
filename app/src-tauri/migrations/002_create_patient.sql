CREATE TABLE IF NOT EXISTS Patient (
    id          TEXT PRIMARY KEY NOT NULL,
    firstName   TEXT NOT NULL,
    lastName    TEXT NOT NULL,
    dateOfBirth TEXT,
    gender      TEXT,
    mrn         TEXT,
    context     TEXT,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zipCode     TEXT,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now')),

    providerId  TEXT NOT NULL,
    FOREIGN KEY (providerId) REFERENCES Provider(id)
);

CREATE INDEX IF NOT EXISTS idx_patient_provider_name ON Patient(providerId, lastName, firstName);
CREATE INDEX IF NOT EXISTS idx_patient_mrn ON Patient(mrn);
