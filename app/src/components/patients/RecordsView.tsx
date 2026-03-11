import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient, CreatePatientInput, UpdatePatientInput } from "../../types";
import Modal from "../ui/Modal";
import SearchInput from "../ui/SearchInput";
import PatientList from "./PatientList";
import PatientForm from "./PatientForm";

export default function RecordsView() {
  const providerId = useAppStore((s) => s.providerId);
  const selectedPatient = useAppStore((s) => s.selectedPatient);
  const setSelectedPatient = useAppStore((s) => s.setSelectedPatient);
  const showPatientForm = useAppStore((s) => s.showPatientForm);
  const openPatientForm = useAppStore((s) => s.openPatientForm);
  const closePatientForm = useAppStore((s) => s.closePatientForm);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const loadPatients = useCallback(async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      setError(null);
      const list = await db.listPatients(providerId);
      setPatients(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        (p.mrn && p.mrn.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)),
    );
  }, [patients, search]);

  function handleEdit(patient: Patient) {
    setEditingPatient(patient);
    openPatientForm();
  }

  async function handleDelete(patient: Patient) {
    if (!confirm(`Delete ${patient.firstName} ${patient.lastName}?`)) return;
    try {
      await db.deletePatient(patient.id);
      if (selectedPatient?.id === patient.id) {
        setSelectedPatient(null);
      }
      await loadPatients();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete patient",
      );
    }
  }

  function handleOpenCreate() {
    setEditingPatient(null);
    openPatientForm();
  }

  function handleCloseForm() {
    setEditingPatient(null);
    closePatientForm();
  }

  async function handleSave(
    input: CreatePatientInput | { id: string; data: UpdatePatientInput },
  ) {
    if ("id" in input) {
      await db.updatePatient(input.id, input.data);
    } else {
      await db.createPatient(input);
    }
    handleCloseForm();
    await loadPatients();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Records</h1>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Add Patient
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, MRN, or email..."
        />
      </div>

      <PatientList
        patients={filtered}
        loading={loading}
        selectedPatient={selectedPatient}
        onSelect={setSelectedPatient}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal
        open={showPatientForm}
        onClose={handleCloseForm}
        title={editingPatient ? "Edit Patient" : "Add Patient"}
      >
        <PatientForm
          patient={editingPatient}
          providerId={providerId!}
          onSave={handleSave}
          onCancel={handleCloseForm}
        />
      </Modal>
    </div>
  );
}
