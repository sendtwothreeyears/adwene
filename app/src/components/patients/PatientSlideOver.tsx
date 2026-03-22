import { X, Pencil } from "lucide-react";
import type { Patient, Session } from "../../types";
import StatusBadge from "../ui/StatusBadge";

interface PatientSlideOverProps {
  patient: Patient;
  sessions: Session[];
  sessionsLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (patient: Patient) => void;
  onSessionSelect: (session: Session) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function PatientSlideOver({
  patient,
  sessions,
  sessionsLoading,
  isOpen,
  onClose,
  onEdit,
  onSessionSelect,
}: PatientSlideOverProps) {
  const address = [patient.address, patient.city, patient.state, patient.zipCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="border-l border-gray-200 bg-white overflow-hidden"
      style={{
        width: isOpen ? 420 : 0,
        transition: "width 300ms ease-in-out",
      }}
    >
      <div className="flex h-full flex-col" style={{ minWidth: 420, width: 420 }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {patient.lastName}, {patient.firstName}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(patient)}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Edit patient"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Demographics */}
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Demographics
            </h3>
            <div className="divide-y divide-gray-100">
              <InfoRow label="DOB" value={patient.dateOfBirth} />
              <InfoRow label="Gender" value={patient.gender} />
              <InfoRow label="MRN" value={patient.mrn} />
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Email" value={patient.email} />
              {address && <InfoRow label="Address" value={address} />}
            </div>
          </div>

          {/* Context */}
          {patient.context && (
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Context
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.context}</p>
            </div>
          )}

          {/* Sessions */}
          <div className="px-4 py-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Sessions ({sessionsLoading ? "..." : sessions.length})
            </h3>

            {sessionsLoading ? (
              <div className="py-6 text-center text-sm text-gray-400">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No sessions</div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSessionSelect(session)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {session.title || "Untitled"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(session.createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={session.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
