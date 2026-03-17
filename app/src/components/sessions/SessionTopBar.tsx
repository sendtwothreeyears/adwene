import { Timer, Trash2 } from "lucide-react";
import type { Patient, Session } from "../../types";
import type { AudioDevice } from "../../hooks/useAudioDevices";
import StatusBadge from "../ui/StatusBadge";
import RecordButton from "./RecordButton";
import MicSelector from "./MicSelector";
import Waveform from "./Waveform";

type PermissionState = "prompt" | "granted" | "denied" | "unknown";

interface SessionTopBarProps {
  session: Session;
  patient: Patient | null;
  isRecording: boolean;
  isTranscribing?: boolean;
  sidecarConnected: boolean;
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  permissionState: PermissionState;
  onSelectDevice: (deviceId: string | null) => void;
  onRequestPermission: () => void;
  audioPreviewStream: MediaStream | null;
  recordingTime: string;
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
  devices,
  selectedDeviceId,
  permissionState,
  onSelectDevice,
  onRequestPermission,
  audioPreviewStream,
  recordingTime,
  onStart,
  onStop,
  confirmDelete,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: SessionTopBarProps) {
  const showMicRow = permissionState === "granted" || permissionState === "prompt" || permissionState === "unknown";

  return (
    <div className="flex flex-col gap-2 pb-4">
      {/* Primary row: patient info + actions */}
      <div className="flex items-center justify-between">
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

      {/* Secondary row: timer + mic selector + audio preview/level — right-aligned */}
      {showMicRow && !confirmDelete && (
        <div className="flex items-center justify-end gap-3">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-gray-600">
              <Timer className="h-3.5 w-3.5" />
              {recordingTime}
            </span>
          )}
          <MicSelector
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            permissionState={permissionState}
            onSelectDevice={onSelectDevice}
            onRequestPermission={onRequestPermission}
          />
          {audioPreviewStream && <Waveform audioStream={audioPreviewStream} />}
        </div>
      )}
    </div>
  );
}
