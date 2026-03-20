import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient, Template } from "../../types";
import Modal from "../ui/Modal";
import TemplateSelectorModal from "../templates/TemplateSelectorModal";
import PatientPickerDropdown from "../patients/PatientPickerDropdown";
import QuickPatientModal from "../patients/QuickPatientModal";

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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showSessionForm || !providerId) return;
    Promise.all([
      db.listPatients(providerId),
      db.listTemplates(providerId),
      db.getProvider(),
    ]).then(([p, t, provider]) => {
      setPatients(p);
      setTemplates(t);
      setSelectedTemplateId(provider?.defaultTemplateId ?? null);
    });
    setSelectedPatientId(null);
    setSelectedTemplateId(null);
    setError(null);
  }, [showSessionForm, providerId]);

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
        title: null,
        transcript: null,
        rawTranscript: null,
        notes: null,
        summary: null,
        context: null,
        preview: null,
      });
      setActiveSession(session);
      closeSessionForm();
      setView("session");
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
        <PatientPickerDropdown
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelect={(patient) => setSelectedPatientId(patient.id)}
          onCreateNew={() => setShowQuickPatient(true)}
          allowNone
          onClearPatient={() => setSelectedPatientId(null)}
          placeholder="Select patient..."
        />
      </div>

      {/* Template selector */}
      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Template (optional)
        </label>
        <button
          type="button"
          onClick={() => setShowTemplateModal(true)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm transition-colors hover:border-gray-400 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {templates.find((t) => t.id === selectedTemplateId)?.name ?? "Select template..."}
        </button>
        <TemplateSelectorModal
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
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
          className="rounded-lg bg-button px-4 py-1.5 text-sm font-medium text-white hover:bg-button-hover transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Session"}
        </button>
      </div>

      {/* Quick patient creation modal */}
      {providerId && (
        <QuickPatientModal
          open={showQuickPatient}
          onClose={() => setShowQuickPatient(false)}
          providerId={providerId}
          onCreated={(newPatient) => {
            setPatients((prev) =>
              [...prev, newPatient].sort((a, b) =>
                a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
              )
            );
            setSelectedPatientId(newPatient.id);
          }}
        />
      )}
    </Modal>
  );
}
