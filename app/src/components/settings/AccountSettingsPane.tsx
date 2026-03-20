import { useState, useEffect, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, remove } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Provider, ProviderType, MedicalSpecialty } from "../../types";
import SearchableSelect from "../ui/SearchableSelect";
import { SPECIALTY_OPTIONS } from "../../data/specialties";
import { COUNTRY_OPTIONS } from "../../data/countries";
import ChangePasswordModal from "./ChangePasswordModal";
import SignatureCanvas from "./SignatureCanvas";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";

const PROVIDER_TYPE_OPTIONS = [
  { value: "MD", label: "MD – Doctor of Medicine" },
  { value: "DO", label: "DO – Doctor of Osteopathic Medicine" },
  { value: "PA", label: "PA – Physician Assistant" },
  { value: "NP", label: "NP – Nurse Practitioner" },
];

const TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "Solo practice" },
  { value: "2-5", label: "2–5 providers" },
  { value: "6-10", label: "6–10 providers" },
  { value: "11-50", label: "11–50 providers" },
  { value: "50+", label: "50+ providers" },
];

function SectionDivider() {
  return <hr className="my-6 border-border" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h3>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start gap-4">
      <label className="w-36 shrink-0 pt-2 text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function AccountSettingsPane() {
  const providerId = useAppStore((s) => s.providerId);
  const logout = useAppStore((s) => s.logout);
  const setProviderPhotoUrl = useAppStore((s) => s.setProviderPhotoUrl);
  const setProviderName = useAppStore((s) => s.setProviderName);

  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [providerType, setProviderType] = useState<string>("");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [officeAddress, setOfficeAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = await db.getProvider();
      if (!p) return;
      setProvider(p);
      setProfilePhotoUrl(p.profilePhoto ? convertFileSrc(p.profilePhoto) : null);
      setFirstName(p.firstName ?? "");
      setLastName(p.lastName ?? "");
      setPhone(p.phone ?? "");
      setProviderType(p.providerType ?? "");
      setSpecialty(p.specialty ?? null);
      setCountry(p.country ?? null);
      setOfficeAddress(p.officeAddress ?? "");
      setCity(p.city ?? "");
      setState(p.state ?? "");
      setZipCode(p.zipCode ?? "");
      setOrganizationName(p.organizationName ?? "");
      setPracticeName(p.practiceName ?? "");
      setTeamSize(p.teamSize ?? null);
      setOrgRole(p.orgRole ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!providerId) return;
    setSaving(true);
    try {
      await db.updateProvider(providerId, {
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        providerType: (providerType as ProviderType) || null,
        specialty: (specialty as MedicalSpecialty) || null,
        country: country || null,
        officeAddress: officeAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        organizationName: organizationName || null,
        practiceName: practiceName || null,
        teamSize: teamSize || null,
        orgRole: orgRole || null,
      });
      // Sync display info to store so Sidebar updates immediately
      const name = [firstName, lastName].filter(Boolean).join(" ") || null;
      setProviderName(name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto() {
    if (!providerId) return;
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (!selected) return;

    const dataDir = await appDataDir();
    const profileDir = `${dataDir}profile`;
    await mkdir(profileDir, { recursive: true });

    const ext = selected.split(".").pop() ?? "png";
    const destPath = `${profileDir}/avatar.${ext}`;

    // Remove old photo if it exists and differs
    if (provider?.profilePhoto && provider.profilePhoto !== destPath) {
      try {
        await remove(provider.profilePhoto);
      } catch {
        // old file may not exist
      }
    }

    await copyFile(selected, destPath);
    await db.updateProvider(providerId, { profilePhoto: destPath });
    const url = convertFileSrc(destPath);
    setProfilePhotoUrl(url);
    setProviderPhotoUrl(url);
    setProvider((prev) => prev ? { ...prev, profilePhoto: destPath } : prev);
  }

  async function handleSaveSignature(dataUrl: string) {
    if (!providerId) return;
    await db.updateProvider(providerId, { signature: dataUrl });
    setProvider((prev) => prev ? { ...prev, signature: dataUrl } : prev);
  }

  async function handlePasswordChanged(newHash: string) {
    if (!providerId) return;
    await db.updateProvider(providerId, { passwordHash: newHash });
    // Refresh local provider state
    const p = await db.getProvider();
    if (p) setProvider(p);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-2xl">
      {/* Section 1: Email + Log out */}
      <SectionLabel>Email</SectionLabel>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-900">{provider?.email ?? "—"}</p>
        <button
          onClick={logout}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Log out
        </button>
      </div>

      <SectionDivider />

      {/* Section: Profile Picture */}
      <SectionLabel>Profile Picture</SectionLabel>
      <div className="flex items-center gap-4">
        {profilePhotoUrl ? (
          <img
            src={profilePhotoUrl}
            alt="Profile"
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
            {(firstName[0] ?? "").toUpperCase()}
            {(lastName[0] ?? "").toUpperCase()}
          </div>
        )}
        <button
          onClick={handleUploadPhoto}
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {profilePhotoUrl ? "Change Photo" : "Upload Photo"}
        </button>
      </div>

      <SectionDivider />

      {/* Section 2: Medical Specialty */}
      <SectionLabel>Medical Specialty</SectionLabel>
      <SearchableSelect
        options={SPECIALTY_OPTIONS}
        value={specialty}
        onChange={setSpecialty}
        placeholder="Select specialty..."
      />

      <SectionDivider />

      {/* Section 3: Personal Info */}
      <SectionLabel>Personal Information</SectionLabel>
      <FieldRow label="First Name">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </FieldRow>
      <FieldRow label="Last Name">
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputClass}
        />
      </FieldRow>
      <FieldRow label="Phone">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </FieldRow>
      <FieldRow label="Provider Type">
        <select
          value={providerType}
          onChange={(e) => setProviderType(e.target.value)}
          className={inputClass}
        >
          <option value="">Select...</option>
          {PROVIDER_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Country">
        <SearchableSelect
          options={COUNTRY_OPTIONS}
          value={country}
          onChange={setCountry}
          placeholder="Select country..."
        />
      </FieldRow>
      <FieldRow label="Office Address">
        <input
          value={officeAddress}
          onChange={(e) => setOfficeAddress(e.target.value)}
          className={inputClass}
        />
      </FieldRow>
      <div className="mb-3 flex items-start gap-4">
        <label className="w-36 shrink-0 pt-2 text-sm font-medium text-gray-700">
          City / State / Zip
        </label>
        <div className="flex flex-1 gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className={inputClass}
          />
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
            className={`${inputClass} max-w-[100px]`}
          />
          <input
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="Zip"
            className={`${inputClass} max-w-[100px]`}
          />
        </div>
      </div>

      <SectionDivider />

      {/* Section 4: Organization */}
      <SectionLabel>Organization</SectionLabel>
      <FieldRow label="Organization">
        <input
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          className={inputClass}
        />
      </FieldRow>
      <FieldRow label="Practice Name">
        <input
          value={practiceName}
          onChange={(e) => setPracticeName(e.target.value)}
          className={inputClass}
        />
      </FieldRow>
      <FieldRow label="Team Size">
        <select
          value={teamSize ?? ""}
          onChange={(e) => setTeamSize(e.target.value || null)}
          className={inputClass}
        >
          <option value="">Select...</option>
          {TEAM_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Role">
        <input
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value)}
          className={inputClass}
        />
      </FieldRow>

      {/* Save button for personal info + org */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-button px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-button-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>

      <SectionDivider />

      {/* Section: Signature */}
      <SectionLabel>Signature</SectionLabel>
      <SignatureCanvas
        savedSignature={provider?.signature ?? null}
        onSave={handleSaveSignature}
      />

      <SectionDivider />

      {/* Section 5: Password */}
      <SectionLabel>Password</SectionLabel>
      <button
        onClick={() => setShowPasswordModal(true)}
        className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        Change Password
      </button>

      {provider?.passwordHash && (
        <ChangePasswordModal
          open={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          currentPasswordHash={provider.passwordHash}
          onChanged={handlePasswordChanged}
        />
      )}

      <SectionDivider />

      {/* Section 6: Privacy & Security */}
      <SectionLabel>Privacy & Security</SectionLabel>
      <p className="text-sm text-gray-600">
        All data is stored locally on your device. No data is sent to external
        servers.
      </p>
    </div>
  );
}
