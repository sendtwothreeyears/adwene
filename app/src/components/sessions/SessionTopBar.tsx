import { Trash2 } from "lucide-react";
import type { Patient, Session } from "../../types";
import StatusBadge from "../ui/StatusBadge";
import RecordButton from "./RecordButton";
import AudioLevel from "./AudioLevel";

interface SessionTopBarProps {
  session: Session;
  patient: Patient | null;
  isRecording: boolean;
  isTranscribing?: boolean;
  sidecarConnected: boolean;
  audioLevel: number;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  confirmDelete: boolean;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

export default function SessionTopBar({
  session,
  patient,
  isRecording,
  isTranscribing,
  sidecarConnected,
  audioLevel,
  onStart,
  onStop,
  confirmDelete,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
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
        {confirmDelete ? (
          <>
            <span className="text-sm text-gray-500">Delete session?</span>
            <button
              onClick={onDeleteConfirm}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Yes, delete
            </button>
            <button
              onClick={onDeleteCancel}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {!sidecarConnected && !isRecording && (
              <span className="text-xs text-red-500">Sidecar offline</span>
            )}
            {isTranscribing && (
              <span className="text-xs text-amber-600 animate-pulse">Transcribing...</span>
            )}
            <AudioLevel level={audioLevel} visible={isRecording} />
            <RecordButton
              isRecording={isRecording}
              disabled={isTranscribing || (!isRecording && !sidecarConnected)}
              onStart={onStart}
              onStop={onStop}
            />
            <button
              onClick={onDeleteRequest}
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              title="Delete session"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
