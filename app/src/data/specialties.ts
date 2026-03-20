import type { MedicalSpecialty } from "../types";

export interface SelectOption {
  value: string;
  label: string;
}

const SPECIALTY_LABELS: Record<MedicalSpecialty, string> = {
  FAMILY_MEDICINE: "Family Medicine",
  INTERNAL_MEDICINE: "Internal Medicine",
  PEDIATRICS: "Pediatrics",
  GERIATRICS: "Geriatrics",
  EMERGENCY_MEDICINE: "Emergency Medicine",
  CRITICAL_CARE: "Critical Care",
  URGENT_CARE: "Urgent Care",
  GENERAL_SURGERY: "General Surgery",
  ORTHOPEDIC_SURGERY: "Orthopedic Surgery",
  NEUROSURGERY: "Neurosurgery",
  PLASTIC_SURGERY: "Plastic Surgery",
  CARDIOTHORACIC_SURGERY: "Cardiothoracic Surgery",
  VASCULAR_SURGERY: "Vascular Surgery",
  TRAUMA_SURGERY: "Trauma Surgery",
  CARDIOLOGY: "Cardiology",
  PULMONOLOGY: "Pulmonology",
  GASTROENTEROLOGY: "Gastroenterology",
  NEPHROLOGY: "Nephrology",
  ENDOCRINOLOGY: "Endocrinology",
  RHEUMATOLOGY: "Rheumatology",
  INFECTIOUS_DISEASE: "Infectious Disease",
  HEMATOLOGY: "Hematology",
  ONCOLOGY: "Oncology",
  OBSTETRICS_GYNECOLOGY: "Obstetrics & Gynecology",
  MATERNAL_FETAL_MEDICINE: "Maternal-Fetal Medicine",
  PSYCHIATRY: "Psychiatry",
  CHILD_PSYCHIATRY: "Child & Adolescent Psychiatry",
  ADDICTION_MEDICINE: "Addiction Medicine",
  DERMATOLOGY: "Dermatology",
  OPHTHALMOLOGY: "Ophthalmology",
  OTOLARYNGOLOGY: "Otolaryngology (ENT)",
  UROLOGY: "Urology",
  NEUROLOGY: "Neurology",
  RADIOLOGY: "Radiology",
  ANESTHESIOLOGY: "Anesthesiology",
  PATHOLOGY: "Pathology",
  PHYSICAL_MEDICINE_REHABILITATION: "Physical Medicine & Rehabilitation",
  PAIN_MANAGEMENT: "Pain Management",
  PALLIATIVE_CARE: "Palliative Care",
  SPORTS_MEDICINE: "Sports Medicine",
  OCCUPATIONAL_MEDICINE: "Occupational Medicine",
  PREVENTIVE_MEDICINE: "Preventive Medicine",
  OTHER: "Other",
};

export const SPECIALTY_OPTIONS: SelectOption[] = Object.entries(SPECIALTY_LABELS).map(
  ([value, label]) => ({ value, label })
);
