CREATE TABLE IF NOT EXISTS Provider (
    id           TEXT PRIMARY KEY NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    firstName    TEXT,
    lastName     TEXT,
    providerType TEXT,

    -- Profile - Basic Info
    title        TEXT,
    bio          TEXT,
    profilePhoto TEXT,

    -- Profile - Contact & Location
    city          TEXT,
    state         TEXT,
    country       TEXT,
    zipCode       TEXT,
    phone         TEXT,
    faxNumber     TEXT,
    officeAddress TEXT,

    -- Profile - Professional
    specialty           TEXT,
    organizationName    TEXT,
    practiceName        TEXT,
    npi                 TEXT UNIQUE,
    licenseNumber       TEXT,
    licenseState        TEXT,
    deaNumber           TEXT,
    taxId               TEXT,
    languages           TEXT,
    yearsOfExperience   INTEGER,
    boardCertifications TEXT,

    -- Timestamps
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_email ON Provider(email);
