import { FilePlus, Timer, Trash2 } from "lucide-react";
import type { Patient, Session } from "../../types";
import type { AudioDevice } from "../../hooks/useAudioDevices";
import StatusBadge from "../ui/StatusBadge";
import RecordButton from "./RecordButton";
import MicSelector from "./MicSelector";
import Waveform from "./Waveform";
import PatientPickerDropdown from "../patients/PatientPickerDropdown";

type PermissionState = "prompt" | "granted" | "denied" | "unknown";

interface SessionTopBarProps {
  session: Session;
  patients: Patient[];
  onPatientChange: (patient: Patient) => void;
  onCreatePatient: () => void;
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
  hasTranscript: boolean;
  onAddNote: () => void;
}

export default function SessionTopBar({
  session,
  patients,
  onPatientChange,
  onCreatePatient,
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
  hasTranscript,
  onAddNote,
}: SessionTopBarProps) {
  const showMicRow = permissionState === "granted" || permissionState === "prompt" || permissionState === "unknown";

  return (
    <div className="flex flex-col">
      {/* Primary row: patient info + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PatientPickerDropdown
            patients={patients}
            selectedPatientId={session.patientId}
            onSelect={onPatientChange}
            onCreateNew={onCreatePatient}
            placeholder="Add patient..."
          />
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
            <button
              onClick={onDeleteRequest}
              className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-500"
              title="Delete session"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <StatusBadge status={session.status} />
        </div>

        <div className="flex items-center gap-2">
          {!confirmDelete && (
            <>
              <button
                onClick={onAddNote}
                disabled={!hasTranscript || isRecording || !!isTranscribing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-dark px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:bg-[#a3a3a3]"
                title={!hasTranscript ? "Record a transcript first" : "New note"}
              >
                <FilePlus className="h-4 w-4" />
                New Note
              </button>
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
            </>
          )}
        </div>
      </div>

      {/* Secondary row: title left, mic/waveform right */}
      {!confirmDelete && (
        <div className="flex items-center justify-between">
          {session.title ? (
            <div className="flex items-center text-sm italic text-gray-400" style={{ marginTop: "-20px" }}>
              <svg width="12" height="24" viewBox="0 0 12 24" className="shrink-0 text-gray-300" style={{ marginBottom: "8px" }}>
                <path d="M1 0 L1 16 Q1 19 4 19 L12 19" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="pl-1">{session.title}</div>
            </div>
          ) : (
            <span />
          )}
          {showMicRow && (
          <div
            className={`flex items-center justify-end gap-3 rounded-lg px-3 py-1.5 ${isRecording ? "bg-red-50" : ""}`}
            style={{ width: 250 }}
          >
            {isRecording ? (
              <>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium tabular-nums text-gray-600">
                  <Timer className="h-3.5 w-3.5" />
                  {recordingTime}
                </span>
                {audioPreviewStream && (
                  <div className="flex-1 min-w-0">
                    <Waveform audioStream={audioPreviewStream} mode="rolling" />
                  </div>
                )}
              </>
            ) : (
              <>
                <MicSelector
                  devices={devices}
                  selectedDeviceId={selectedDeviceId}
                  permissionState={permissionState}
                  onSelectDevice={onSelectDevice}
                  onRequestPermission={onRequestPermission}
                />
                {audioPreviewStream && <Waveform audioStream={audioPreviewStream} mode="bars" />}
              </>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
