import { useState } from "react";
import Modal from "../ui/Modal";
import * as db from "../../lib/db";
import type { Patient } from "../../types";

interface QuickPatientModalProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  onCreated: (patient: Patient) => void;
}

export default function QuickPatientModal({
  open,
  onClose,
  providerId,
  onCreated,
}: QuickPatientModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const patient = await db.createPatient({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: null,
        gender: null,
        mrn: null,
        context: null,
        phone: null,
        email: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        providerId,
      });
      onCreated(patient);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create patient");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setFirstName("");
    setLastName("");
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Patient">
      <p className="mb-4 text-sm text-gray-500">
        Set up a patient profile in order to link multiple sessions together.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !firstName.trim() || !lastName.trim()}
            className="rounded-lg bg-button px-4 py-1.5 text-sm font-medium text-white hover:bg-button-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
