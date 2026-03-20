CREATE TABLE IF NOT EXISTS Tag (
    id   TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS TemplateTag (
    templateId TEXT NOT NULL,
    tagId      TEXT NOT NULL,
    PRIMARY KEY (templateId, tagId),
    FOREIGN KEY (templateId) REFERENCES Template(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId)      REFERENCES Tag(id)      ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_tag_template ON TemplateTag(templateId);
CREATE INDEX IF NOT EXISTS idx_template_tag_tag      ON TemplateTag(tagId);
