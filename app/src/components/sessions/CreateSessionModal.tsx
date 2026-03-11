import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient, Template } from "../../types";
import Modal from "../ui/Modal";
import SearchInput from "../ui/SearchInput";
import TemplateSelector from "../templates/TemplateSelector";

export default function CreateSessionModal() {
  const providerId = useAppStore((s) => s.providerId);
  const showSessionForm = useAppStore((s) => s.showSessionForm);
  const closeSessionForm = useAppStore((s) => s.closeSessionForm);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setView = useAppStore((s) => s.setView);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showSessionForm || !providerId) return;
    Promise.all([
      db.listPatients(providerId),
      db.listTemplates(providerId),
    ]).then(([p, t]) => {
      setPatients(p);
      setTemplates(t);
    });
    setSelectedPatientId(null);
    setSelectedTemplateId(null);
    setPatientSearch("");
    setError(null);
  }, [showSessionForm, providerId]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q),
    );
  }, [patients, patientSearch]);

  async function handleCreate() {
    if (!providerId) return;
    try {
      setSubmitting(true);
      setError(null);
      const session = await db.createSession({
        status: "DRAFT",
        providerId,
        patientId: selectedPatientId,
        templateId: selectedTemplateId,
        transcript: null,
        notes: null,
        summary: null,
        context: null,
        preview: null,
      });
      setActiveSession(session);
      closeSessionForm();
      setView("current-session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={showSessionForm}
      onClose={closeSessionForm}
      title="Create Session"
    >
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Patient selector */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Patient (optional)
        </label>
        <SearchInput
          value={patientSearch}
          onChange={setPatientSearch}
          placeholder="Search patients..."
        />
        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-200">
          <button
            onClick={() => setSelectedPatientId(null)}
            className={`w-full px-3 py-2 text-left text-sm transition-colors ${
              selectedPatientId === null
                ? "bg-primary/10 font-medium text-primary"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            No patient
          </button>
          {filteredPatients.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPatientId(p.id)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                selectedPatientId === p.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p.firstName} {p.lastName}
            </button>
          ))}
          {filteredPatients.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No patients found</p>
          )}
        </div>
      </div>

      {/* Template selector */}
      <div className="mb-6">
        <TemplateSelector
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onChange={setSelectedTemplateId}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={closeSessionForm}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Session"}
        </button>
      </div>
    </Modal>
  );
}
