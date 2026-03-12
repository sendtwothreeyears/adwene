// =============================================================================
// Adwene Offline — TypeScript Types
//
// Mirrors the offline SQLite schema (docs/schema/schema.prisma).
// Same field names, same types, same UUID format as the online KasaMD server.
// =============================================================================

// --- Enums (stored as TEXT in SQLite) ---

export type ProviderType = "MD" | "DO" | "PA" | "NP";

export type SessionStatus = "DRAFT" | "COMPLETED" | "FINALIZED" | "ERROR";

export type MedicalSpecialty =
  | "FAMILY_MEDICINE"
  | "INTERNAL_MEDICINE"
  | "PEDIATRICS"
  | "GERIATRICS"
  | "EMERGENCY_MEDICINE"
  | "CRITICAL_CARE"
  | "URGENT_CARE"
  | "GENERAL_SURGERY"
  | "ORTHOPEDIC_SURGERY"
  | "NEUROSURGERY"
  | "PLASTIC_SURGERY"
  | "CARDIOTHORACIC_SURGERY"
  | "VASCULAR_SURGERY"
  | "TRAUMA_SURGERY"
  | "CARDIOLOGY"
  | "PULMONOLOGY"
  | "GASTROENTEROLOGY"
  | "NEPHROLOGY"
  | "ENDOCRINOLOGY"
  | "RHEUMATOLOGY"
  | "INFECTIOUS_DISEASE"
  | "HEMATOLOGY"
  | "ONCOLOGY"
  | "OBSTETRICS_GYNECOLOGY"
  | "MATERNAL_FETAL_MEDICINE"
  | "PSYCHIATRY"
  | "CHILD_PSYCHIATRY"
  | "ADDICTION_MEDICINE"
  | "DERMATOLOGY"
  | "OPHTHALMOLOGY"
  | "OTOLARYNGOLOGY"
  | "UROLOGY"
  | "NEUROLOGY"
  | "RADIOLOGY"
  | "ANESTHESIOLOGY"
  | "PATHOLOGY"
  | "PHYSICAL_MEDICINE_REHABILITATION"
  | "PAIN_MANAGEMENT"
  | "PALLIATIVE_CARE"
  | "SPORTS_MEDICINE"
  | "OCCUPATIONAL_MEDICINE"
  | "PREVENTIVE_MEDICINE"
  | "OTHER";

// --- Core Models ---

export interface Provider {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  providerType: ProviderType | null;
  title: string | null;
  bio: string | null;
  profilePhoto: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  phone: string | null;
  faxNumber: string | null;
  officeAddress: string | null;
  specialty: MedicalSpecialty | null;
  organizationName: string | null;
  practiceName: string | null;
  npi: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  deaNumber: string | null;
  taxId: string | null;
  languages: string | null;
  yearsOfExperience: number | null;
  boardCertifications: unknown[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  mrn: string | null;
  context: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: string;
  updatedAt: string;
  providerId: string;
}

export interface Template {
  id: string;
  name: string;
  content: unknown;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  providerId: string | null;
}

export interface Session {
  id: string;
  transcript: unknown | null;
  rawTranscript: string | null;
  notes: unknown | null;
  summary: string | null;
  context: unknown | null;
  status: SessionStatus;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  patientId: string | null;
  templateId: string | null;
}

// --- Input Types ---

export type CreatePatientInput = Omit<Patient, "id" | "createdAt" | "updatedAt">;

export type UpdatePatientInput = Partial<
  Omit<Patient, "id" | "createdAt" | "updatedAt" | "providerId">
>;

export type CreateTemplateInput = Omit<Template, "id" | "createdAt" | "updatedAt">;

export type UpdateTemplateInput = Partial<
  Omit<Template, "id" | "createdAt" | "updatedAt">
>;

export type CreateSessionInput = Omit<Session, "id" | "createdAt" | "updatedAt">;

export type UpdateSessionInput = Partial<
  Omit<Session, "id" | "createdAt" | "updatedAt" | "providerId">
>;
