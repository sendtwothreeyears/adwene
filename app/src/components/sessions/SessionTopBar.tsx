import { Trash2, Mic } from "lucide-react";
import type { Patient, Session } from "../../types";
import StatusBadge from "../ui/StatusBadge";

interface SessionTopBarProps {
  session: Session;
  patient: Patient | null;
  onDelete: () => void;
}

export default function SessionTopBar({
  session,
  patient,
  onDelete,
}: SessionTopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900">
          {patient
            ? `${patient.firstName} ${patient.lastName}`
            : "No patient linked"}
        </h1>
        <StatusBadge status={session.status} />
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-400"
          title="Coming in Step 4"
        >
          <Mic className="h-4 w-4" />
          Create Transcription
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Delete session"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
