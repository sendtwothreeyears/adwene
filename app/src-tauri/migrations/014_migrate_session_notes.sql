-- Migrate existing session.notes data into the session_notes table.
-- For each session with non-null notes, create a SessionNote row using
-- the session's templateId (or the first system SOAP Note template as fallback).
INSERT INTO SessionNote (id, sessionId, templateId, templateName, content, createdAt, updatedAt)
SELECT
    lower(hex(randomblob(16))),
    s.id,
    COALESCE(s.templateId, (SELECT t.id FROM Template t WHERE t.name = 'SOAP Note' AND t.isSystem = 1 LIMIT 1)),
    COALESCE(t.name, 'SOAP Note'),
    s.notes,
    s.createdAt,
    s.updatedAt
FROM Session s
LEFT JOIN Template t ON t.id = s.templateId
WHERE s.notes IS NOT NULL AND s.notes != '';
