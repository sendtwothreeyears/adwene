import { useState } from "react";
import type { ProviderType, MedicalSpecialty } from "../../types";
import SearchableSelect from "../ui/SearchableSelect";
import { SPECIALTY_OPTIONS } from "../../data/specialties";
import { COUNTRY_OPTIONS } from "../../data/countries";

export interface OnboardingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  providerType: ProviderType;
  specialty: MedicalSpecialty | null;
  country: string | null;
  organizationName: string | null;
  practiceName: string | null;
  teamSize: string | null;
  orgRole: string | null;
}

interface ProviderSetupProps {
  onSubmit: (data: OnboardingData) => Promise<void>;
}

const TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "Solo practice" },
  { value: "2-5", label: "2–5 providers" },
  { value: "6-10", label: "6–10 providers" },
  { value: "11-50", label: "11–50 providers" },
  { value: "50+", label: "50+ providers" },
];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";

export default function ProviderSetup({ onSubmit }: ProviderSetupProps) {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("MD");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  // Step 2 fields
  const [organizationName, setOrganizationName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step1Valid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (step1Valid) setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        providerType,
        specialty: (specialty as MedicalSpecialty) ?? null,
        country: country ?? null,
        organizationName: organizationName.trim() || null,
        practiceName: practiceName.trim() || null,
        teamSize: teamSize ?? null,
        orgRole: orgRole.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create provider");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        {/* Header */}
        <h1 className="mb-1 font-ddn text-2xl font-bold text-primary">KasaMD</h1>
        <p className="mb-2 text-sm text-gray-500">
          {step === 1
            ? "Set up your provider profile to get started."
            : "Tell us about your organisation."}
        </p>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-button" : "bg-gray-200"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-button" : "bg-gray-200"}`} />
        </div>

        {step === 1 ? (
          <form onSubmit={handleNext} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Provider Type</label>
              <select
                value={providerType}
                onChange={(e) => setProviderType(e.target.value as ProviderType)}
                className={inputClass}
              >
                <option value="MD">MD — Doctor of Medicine</option>
                <option value="DO">DO — Doctor of Osteopathic Medicine</option>
                <option value="PA">PA — Physician Assistant</option>
                <option value="NP">NP — Nurse Practitioner</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Specialty</label>
              <SearchableSelect
                options={SPECIALTY_OPTIONS}
                value={specialty}
                onChange={setSpecialty}
                placeholder="Select specialty..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Country</label>
              <SearchableSelect
                options={COUNTRY_OPTIONS}
                value={country}
                onChange={setCountry}
                placeholder="Select country..."
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={!step1Valid}
              className="w-full rounded-lg bg-button px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Organisation Name
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. City Health Partners"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Practice Name</label>
              <input
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                placeholder="e.g. Downtown Family Clinic"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Team Size</label>
              <SearchableSelect
                options={TEAM_SIZE_OPTIONS}
                value={teamSize}
                onChange={setTeamSize}
                placeholder="Select team size..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Your Role</label>
              <input
                type="text"
                value={orgRole}
                onChange={(e) => setOrgRole(e.target.value)}
                placeholder="e.g. Chief Medical Officer"
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-button px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Get Started"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
