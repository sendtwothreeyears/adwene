import { Pencil, Trash2 } from "lucide-react";
import type { Patient } from "../../types";

interface PatientCardProps {
  patient: Patient;
  selected: boolean;
  onSelect: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
}

export default function PatientCard({
  patient,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: PatientCardProps) {
  const dob = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString()
    : "—";

  return (
    <div
      onClick={() => onSelect(patient)}
      className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {patient.lastName}, {patient.firstName}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          DOB: {dob}
          {patient.mrn && <span className="ml-3">MRN: {patient.mrn}</span>}
          {patient.gender && <span className="ml-3">{patient.gender}</span>}
        </p>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(patient);
          }}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Edit patient"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(patient);
          }}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Delete patient"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
