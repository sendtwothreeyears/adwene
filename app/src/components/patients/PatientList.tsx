import type { Patient } from "../../types";
import PatientCard from "./PatientCard";

interface PatientListProps {
  patients: Patient[];
  loading: boolean;
  selectedPatient: Patient | null;
  onSelect: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
}

export default function PatientList({
  patients,
  loading,
  selectedPatient,
  onSelect,
  onEdit,
  onDelete,
}: PatientListProps) {
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Loading patients...
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        No patients found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {patients.map((patient) => (
        <PatientCard
          key={patient.id}
          patient={patient}
          selected={selectedPatient?.id === patient.id}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
