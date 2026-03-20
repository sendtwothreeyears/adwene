import { useState, useRef, useEffect, useMemo } from "react";
import { UserRound, Plus, Search, Check } from "lucide-react";
import type { Patient } from "../../types";

interface PatientPickerDropdownProps {
  patients: Patient[];
  selectedPatientId: string | null;
  onSelect: (patient: Patient) => void;
  onCreateNew: () => void;
  allowNone?: boolean;
  onClearPatient?: () => void;
  placeholder?: string;
}

export default function PatientPickerDropdown({
  patients,
  selectedPatientId,
  onSelect,
  onCreateNew,
  allowNone = false,
  onClearPatient,
  placeholder = "Add patient details",
}: PatientPickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return patients;
    const q = query.toLowerCase();
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q),
    );
  }, [patients, query]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleToggle() {
    setOpen((prev) => !prev);
    setQuery("");
  }

  function handleSelect(patient: Patient) {
    onSelect(patient);
    setOpen(false);
    setQuery("");
  }

  function handleCreateNew() {
    setOpen(false);
    setQuery("");
    onCreateNew();
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 py-1 text-sm transition-colors focus:outline-none"
      >
        <UserRound className="h-5 w-5 text-primary" />
        <span
          className={`border-b pr-[25px] ${
            selectedPatient
              ? "border-primary text-gray-900 font-medium"
              : "border-gray-400 text-gray-500"
          } pb-0.5`}
        >
          {selectedPatient
            ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
            : placeholder}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Create new patient action */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-sm font-medium text-primary hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create new patient
          </button>

          {/* Search input */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patients..."
                className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Patient list */}
          <ul className="max-h-48 overflow-y-auto px-1 pb-1">
            {allowNone && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onClearPatient?.();
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
                    selectedPatientId === null
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  No patient
                  {selectedPatientId === null && <Check className="h-3.5 w-3.5" />}
                </button>
              </li>
            )}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(p)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
                    p.id === selectedPatientId
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p.firstName} {p.lastName}
                  {p.id === selectedPatientId && <Check className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No patients found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
