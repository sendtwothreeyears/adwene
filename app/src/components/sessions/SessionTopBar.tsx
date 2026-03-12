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
  onDelete: () => void;
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
        {!sidecarConnected && !isRecording && (
          <span className="text-xs text-red-500">Sidecar offline</span>
        )}
        {isTranscribing && (
          <span className="text-xs text-amber-600 animate-pulse">Transcribing...</span>
        )}
        <AudioLevel level={audioLevel} visible={isRecording} />
        <RecordButton
          isRecording={isRecording}
          disabled={isTranscribing || !sidecarConnected}
          onStart={onStart}
          onStop={onStop}
        />
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
