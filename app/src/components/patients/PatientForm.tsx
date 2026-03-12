import { useState, useEffect } from "react";
import type { Patient, CreatePatientInput, UpdatePatientInput } from "../../types";

interface PatientFormProps {
  patient: Patient | null;
  providerId: string;
  onSave: (input: CreatePatientInput | { id: string; data: UpdatePatientInput }) => Promise<void>;
  onCancel: () => void;
}

const GENDER_OPTIONS = ["", "Male", "Female", "Other", "Prefer not to say"];

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";

export default function PatientForm({
  patient,
  providerId,
  onSave,
  onCancel,
}: PatientFormProps) {
  const isEdit = patient !== null;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [mrn, setMrn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [context, setContext] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setFirstName(patient.firstName);
      setLastName(patient.lastName);
      setDateOfBirth(patient.dateOfBirth ?? "");
      setGender(patient.gender ?? "");
      setMrn(patient.mrn ?? "");
      setPhone(patient.phone ?? "");
      setEmail(patient.email ?? "");
      setAddress(patient.address ?? "");
      setCity(patient.city ?? "");
      setState(patient.state ?? "");
      setZipCode(patient.zipCode ?? "");
      setContext(patient.context ?? "");
    }
  }, [patient]);

  const isValid = firstName.trim() !== "" && lastName.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setError(null);
    setSubmitting(true);

    try {
      if (isEdit) {
        await onSave({
          id: patient.id,
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dateOfBirth: dateOfBirth || null,
            gender: gender || null,
            mrn: mrn.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            zipCode: zipCode.trim() || null,
            context: context.trim() || null,
          },
        });
      } else {
        await onSave({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
          mrn: mrn.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zipCode: zipCode.trim() || null,
          context: context.trim() || null,
          providerId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save patient");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Date of Birth
          </label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Gender
          </label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={inputClass}
          >
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g || "Select..."}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          MRN
        </label>
        <input
          type="text"
          value={mrn}
          onChange={(e) => setMrn(e.target.value)}
          className={inputClass}
          placeholder="Medical Record Number"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Address
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            City
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            State
          </label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Zip Code
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Clinical Context
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className={inputClass}
          rows={3}
          placeholder="Relevant clinical notes, allergies, conditions..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid || submitting}
          className="rounded-lg bg-button px-4 py-2 text-sm font-medium text-white hover:bg-button-hover transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving..." : isEdit ? "Update Patient" : "Add Patient"}
        </button>
      </div>
    </form>
  );
}
