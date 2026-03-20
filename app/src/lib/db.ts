import Database from "@tauri-apps/plugin-sql";
import type {
  Provider,
  Patient,
  Template,
  Session,
  CreatePatientInput,
  UpdatePatientInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateSessionInput,
  UpdateSessionInput,
  Attachment,
  CreateAttachmentInput,
  Tag,
} from "../types";

const DB_NAME = "sqlite:adwene.db";

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME);
    await dbInstance.execute("PRAGMA foreign_keys = ON");
  }
  return dbInstance;
}

function nowISO(): string {
  return new Date().toISOString();
}

// =============================================================================
// Provider
// =============================================================================

export async function createProvider(input: Omit<Provider, "createdAt" | "updatedAt">): Promise<Provider> {
  const db = await getDb();
  const now = nowISO();

  await db.execute(
    `INSERT INTO Provider (
      id, email, firstName, lastName, providerType,
      title, bio, profilePhoto,
      city, state, country, zipCode, phone, faxNumber, officeAddress,
      specialty, organizationName, practiceName, npi, licenseNumber,
      licenseState, deaNumber, taxId, languages, yearsOfExperience,
      boardCertifications, passwordHash, teamSize, orgRole, defaultTemplateId, signature,
      createdAt, updatedAt
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25,
      $26, $27, $28, $29, $30, $31,
      $32, $33
    )`,
    [
      input.id, input.email, input.firstName, input.lastName, input.providerType,
      input.title, input.bio, input.profilePhoto,
      input.city, input.state, input.country, input.zipCode,
      input.phone, input.faxNumber, input.officeAddress,
      input.specialty, input.organizationName, input.practiceName,
      input.npi, input.licenseNumber, input.licenseState,
      input.deaNumber, input.taxId, input.languages, input.yearsOfExperience,
      input.boardCertifications ? JSON.stringify(input.boardCertifications) : null,
      input.passwordHash, input.teamSize, input.orgRole, input.defaultTemplateId ?? null,
      input.signature ?? null,
      now, now,
    ]
  );

  return { ...input, createdAt: now, updatedAt: now };
}

export async function updateProvider(id: string, input: Partial<Omit<Provider, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "boardCertifications" && value !== null) {
        fields.push(`${key} = $${idx}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${idx}`);
        values.push(value);
      }
      idx++;
    }
  }

  fields.push(`updatedAt = $${idx}`);
  values.push(now);
  idx++;
  values.push(id);

  await db.execute(
    `UPDATE Provider SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );
}

export async function getProvider(): Promise<Provider | null> {
  const db = await getDb();
  const rows = await db.select<Provider[]>("SELECT * FROM Provider LIMIT 1");
  if (rows.length === 0) return null;
  const p = rows[0];
  if (typeof p.boardCertifications === "string") {
    p.boardCertifications = JSON.parse(p.boardCertifications as unknown as string);
  }
  return p;
}

// =============================================================================
// Patient
// =============================================================================

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = nowISO();

  await db.execute(
    `INSERT INTO Patient (
      id, firstName, lastName, dateOfBirth, gender, mrn, context,
      phone, email, address, city, state, zipCode,
      providerId, createdAt, updatedAt
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      id, input.firstName, input.lastName, input.dateOfBirth, input.gender,
      input.mrn, input.context, input.phone, input.email, input.address,
      input.city, input.state, input.zipCode, input.providerId, now, now,
    ]
  );

  return { ...input, id, createdAt: now, updatedAt: now };
}

export async function listPatients(providerId: string): Promise<Patient[]> {
  const db = await getDb();
  return db.select<Patient[]>(
    "SELECT * FROM Patient WHERE providerId = $1 ORDER BY lastName ASC, firstName ASC",
    [providerId]
  );
}

export async function getPatient(id: string): Promise<Patient | null> {
  const db = await getDb();
  const rows = await db.select<Patient[]>("SELECT * FROM Patient WHERE id = $1", [id]);
  return rows.length > 0 ? rows[0] : null;
}

export async function updatePatient(id: string, input: UpdatePatientInput): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  fields.push(`updatedAt = $${idx}`);
  values.push(now);
  idx++;
  values.push(id);

  await db.execute(
    `UPDATE Patient SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );
}

export async function deletePatient(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM Patient WHERE id = $1", [id]);
}

// =============================================================================
// Template
// =============================================================================

export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = nowISO();

  await db.execute(
    `INSERT INTO Template (
      id, name, content, description, isSystem, providerId, createdAt, updatedAt
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id, input.name, JSON.stringify(input.content), input.description,
      input.isSystem ? 1 : 0, input.providerId, now, now,
    ]
  );

  return { ...input, id, isFavourite: false, createdAt: now, updatedAt: now };
}

function parseTemplateRow(t: Template): Template {
  return {
    ...t,
    isSystem: Boolean(t.isSystem),
    isFavourite: Boolean(t.isFavourite),
    content: typeof t.content === "string" ? JSON.parse(t.content as unknown as string) : t.content,
  };
}

export async function listTemplates(providerId: string): Promise<Template[]> {
  const db = await getDb();
  const rows = await db.select<Template[]>(
    "SELECT * FROM Template WHERE providerId = $1 OR isSystem = 1 ORDER BY name ASC",
    [providerId]
  );
  return rows.map(parseTemplateRow);
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = await getDb();
  const rows = await db.select<Template[]>("SELECT * FROM Template WHERE id = $1", [id]);
  if (rows.length === 0) return null;
  return parseTemplateRow(rows[0]);
}

export async function updateTemplate(id: string, input: UpdateTemplateInput): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "content") {
        fields.push(`content = $${idx}`);
        values.push(JSON.stringify(value));
      } else if (key === "isSystem" || key === "isFavourite") {
        fields.push(`${key} = $${idx}`);
        values.push(value ? 1 : 0);
      } else {
        fields.push(`${key} = $${idx}`);
        values.push(value);
      }
      idx++;
    }
  }

  fields.push(`updatedAt = $${idx}`);
  values.push(now);
  idx++;
  values.push(id);

  await db.execute(
    `UPDATE Template SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );
}

export async function toggleTemplateFavourite(id: string, isFavourite: boolean): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  await db.execute(
    "UPDATE Template SET isFavourite = $1, updatedAt = $2 WHERE id = $3",
    [isFavourite ? 1 : 0, now, id]
  );
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM Template WHERE id = $1", [id]);
}

// =============================================================================
// Session
// =============================================================================

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = nowISO();

  await db.execute(
    `INSERT INTO Session (
      id, title, transcript, rawTranscript, notes, summary, context, status, preview,
      providerId, patientId, templateId, createdAt, updatedAt
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      input.title ?? null,
      input.transcript ? JSON.stringify(input.transcript) : null,
      input.rawTranscript ?? null,
      input.notes ? JSON.stringify(input.notes) : null,
      input.summary,
      input.context ? JSON.stringify(input.context) : null,
      input.status || "DRAFT",
      input.preview,
      input.providerId,
      input.patientId,
      input.templateId,
      now, now,
    ]
  );

  return { ...input, id, status: input.status || "DRAFT", createdAt: now, updatedAt: now };
}

export async function listSessions(providerId: string): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.select<Session[]>(
    "SELECT * FROM Session WHERE providerId = $1 ORDER BY createdAt DESC",
    [providerId]
  );
  return rows.map(parseSessionJson);
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.select<Session[]>("SELECT * FROM Session WHERE id = $1", [id]);
  return rows.length > 0 ? parseSessionJson(rows[0]) : null;
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const jsonFields = ["transcript", "notes", "context"];

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (jsonFields.includes(key) && value !== null) {
        fields.push(`${key} = $${idx}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${idx}`);
        values.push(value);
      }
      idx++;
    }
  }

  fields.push(`updatedAt = $${idx}`);
  values.push(now);
  idx++;
  values.push(id);

  await db.execute(
    `UPDATE Session SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  // Cascade: delete attachments first (files cleaned by caller if needed)
  await db.execute("DELETE FROM Attachment WHERE sessionId = $1", [id]);
  await db.execute("DELETE FROM Session WHERE id = $1", [id]);
}

// =============================================================================
// Attachment
// =============================================================================

export async function createAttachment(input: CreateAttachmentInput): Promise<Attachment> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = nowISO();

  await db.execute(
    `INSERT INTO Attachment (
      id, sessionId, fileName, fileSize, mimeType, extractedText, filePath, createdAt, updatedAt
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id, input.sessionId, input.fileName, input.fileSize,
      input.mimeType, input.extractedText, input.filePath, now, now,
    ]
  );

  return { ...input, id, createdAt: now, updatedAt: now };
}

export async function listAttachments(sessionId: string): Promise<Attachment[]> {
  const db = await getDb();
  return db.select<Attachment[]>(
    "SELECT * FROM Attachment WHERE sessionId = $1 ORDER BY createdAt ASC",
    [sessionId]
  );
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const db = await getDb();
  const rows = await db.select<Attachment[]>("SELECT * FROM Attachment WHERE id = $1", [id]);
  return rows.length > 0 ? rows[0] : null;
}

export async function updateAttachmentText(id: string, extractedText: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  await db.execute(
    "UPDATE Attachment SET extractedText = $1, updatedAt = $2 WHERE id = $3",
    [extractedText, now, id]
  );
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM Attachment WHERE id = $1", [id]);
}

export async function deleteAttachmentsBySession(sessionId: string): Promise<Attachment[]> {
  const db = await getDb();
  const attachments = await listAttachments(sessionId);
  await db.execute("DELETE FROM Attachment WHERE sessionId = $1", [sessionId]);
  return attachments; // Return so caller can clean up files from disk
}

// =============================================================================
// Tag
// =============================================================================

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.select<Tag[]>("SELECT * FROM Tag ORDER BY name ASC");
}

export async function searchTags(query: string): Promise<Tag[]> {
  const db = await getDb();
  return db.select<Tag[]>(
    "SELECT * FROM Tag WHERE name LIKE $1 ORDER BY name ASC",
    [`%${query.toLowerCase()}%`]
  );
}

export async function getTagsForTemplate(templateId: string): Promise<Tag[]> {
  const db = await getDb();
  return db.select<Tag[]>(
    `SELECT t.* FROM Tag t
     INNER JOIN TemplateTag tt ON tt.tagId = t.id
     WHERE tt.templateId = $1
     ORDER BY t.name ASC`,
    [templateId]
  );
}

export async function addTagsToTemplate(templateId: string, tagNames: string[]): Promise<Tag[]> {
  const db = await getDb();
  const tags: Tag[] = [];

  for (const raw of tagNames) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;

    // Upsert the tag
    const existing = await db.select<Tag[]>("SELECT * FROM Tag WHERE name = $1", [name]);
    let tag: Tag;
    if (existing.length > 0) {
      tag = existing[0];
    } else {
      const id = crypto.randomUUID();
      await db.execute("INSERT INTO Tag (id, name) VALUES ($1, $2)", [id, name]);
      tag = { id, name };
    }

    // Insert junction row (ignore if already exists)
    await db.execute(
      "INSERT OR IGNORE INTO TemplateTag (templateId, tagId) VALUES ($1, $2)",
      [templateId, tag.id]
    );
    tags.push(tag);
  }

  return tags;
}

export async function removeTagFromTemplate(templateId: string, tagId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM TemplateTag WHERE templateId = $1 AND tagId = $2",
    [templateId, tagId]
  );
}

export async function setTagsForTemplate(templateId: string, tagNames: string[]): Promise<Tag[]> {
  const db = await getDb();
  // Clear existing tags for this template
  await db.execute("DELETE FROM TemplateTag WHERE templateId = $1", [templateId]);
  // Add the new set
  if (tagNames.length === 0) return [];
  return addTagsToTemplate(templateId, tagNames);
}

// --- Helpers ---

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseSessionJson(s: Session): Session {
  return {
    ...s,
    transcript: typeof s.transcript === "string" ? JSON.parse(s.transcript as unknown as string) : s.transcript,
    notes: typeof s.notes === "string" ? JSON.parse(s.notes as unknown as string) : s.notes,
    context: typeof s.context === "string" ? tryParseJson(s.context) : s.context ?? null,
  };
}
