import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient } from "../../types";
import type { SerializedEditorState } from "lexical";
import SessionTopBar from "./SessionTopBar";
import SessionTabBar, { type SessionTab } from "./SessionTabBar";
import SessionEditor from "./SessionEditor";
import TranscriptPanel from "./TranscriptPanel";
import { useAudioCapture } from "../../hooks/useAudioCapture";
import { useTranscription } from "../../hooks/useTranscription";
import { useNoteGeneration } from "../../hooks/useNoteGeneration";
import { useSidecar } from "../../contexts/SidecarContext";

/** Maps each tab to the Session field it reads/writes. */
const TAB_FIELD: Record<SessionTab, "context" | "transcript" | "notes"> = {
  context: "context",
  transcription: "transcript",
  note: "notes",
};

const TAB_PLACEHOLDER: Record<SessionTab, string> = {
  context: "Add any additional context about the patient...",
  transcription: "Transcription will appear here during recording...",
  note: "Generated note will appear here...",
};

const SAVE_DEBOUNCE_MS = 800;

export default function SessionView() {
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const mergeActiveSession = useAppStore((s) => s.mergeActiveSession);
  const setView = useAppStore((s) => s.setView);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("context");
  const [error, setError] = useState<string | null>(null);

  const {
    state: captureState,
    audioLevel,
    chunks,
    start,
    stop,
    error: captureError,
  } = useAudioCapture();

  const {
    transcript: _transcript,
    isTranscribing,
    error: transcriptionError,
    startTranscription,
    stopTranscription,
    sendAudioChunk,
  } = useTranscription();

  const {
    isGenerating,
    error: noteError,
    generateNote,
    onNoteGenerated,
  } = useNoteGeneration();

  const { connectionState } = useSidecar();
  const sidecarConnected = connectionState === "connected";

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ sessionId: string; field: string; state: SerializedEditorState } | null>(null);
  const lastChunkIndexRef = useRef(0);

  useEffect(() => {
    if (!activeSession?.patientId) {
      setPatient(null);
      return;
    }
    db.getPatient(activeSession.patientId).then(setPatient).catch(() => setPatient(null));
  }, [activeSession?.patientId]);

  // Forward new audio chunks to the sidecar as they arrive
  useEffect(() => {
    if (captureState !== "recording") return;
    for (let i = lastChunkIndexRef.current; i < chunks.length; i++) {
      sendAudioChunk(chunks[i]);
    }
    lastChunkIndexRef.current = chunks.length;
  }, [chunks, captureState, sendAudioChunk]);

  // Save generated note to DB and update store
  useEffect(() => {
    onNoteGenerated(async (content) => {
      if (!activeSession) return;
      try {
        await db.updateSession(activeSession.id, { notes: content });
        mergeActiveSession({ notes: content as SerializedEditorState });
      } catch (err) {
        console.error("Failed to save generated note:", err);
      }
    });
  }, [activeSession, mergeActiveSession, onNoteGenerated]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const pending = pendingSaveRef.current;
      if (pending) {
        db.updateSession(pending.sessionId, { [pending.field]: pending.state }).catch((err) =>
          console.error(`Failed to flush pending save:`, err),
        );
        pendingSaveRef.current = null;
      }
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!activeSession) return;
    lastChunkIndexRef.current = 0;
    startTranscription(activeSession.id);
    await start();
  }, [activeSession, start, startTranscription]);

  const handleStopRecording = useCallback(async () => {
    await stop();
    const text = await stopTranscription();
    if (text && activeSession) {
      try {
        await db.updateSession(activeSession.id, { rawTranscript: text });
        mergeActiveSession({ rawTranscript: text });
      } catch (err) {
        console.error("Failed to save rawTranscript:", err);
      }
    }
  }, [stop, stopTranscription, activeSession, mergeActiveSession]);

  const handleEditorChange = useCallback(
    (state: SerializedEditorState) => {
      if (!activeSession) return;
      const field = TAB_FIELD[activeTab];

      pendingSaveRef.current = { sessionId: activeSession.id, field, state };

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        pendingSaveRef.current = null;
        try {
          await db.updateSession(activeSession.id, { [field]: state });
          mergeActiveSession({ [field]: state });
        } catch (err) {
          console.error(`Failed to save ${field}:`, err);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [activeSession, activeTab, mergeActiveSession],
  );

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        No active session. Create one to get started.
      </div>
    );
  }

  async function handleDelete() {
    if (!activeSession) return;
    if (!confirm("Delete this session?")) return;
    try {
      await db.deleteSession(activeSession.id);
      setActiveSession(null);
      setView("recent-sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  }

  const field = TAB_FIELD[activeTab];
  const initialState = (activeSession[field] as SerializedEditorState | null) ?? null;
  const isReadOnly = activeTab === "transcription";

  return (
    <div className="mx-auto max-w-3xl">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {captureError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {captureError}
        </div>
      )}

      {transcriptionError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {transcriptionError}
        </div>
      )}

      {noteError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {noteError}
        </div>
      )}

      <SessionTopBar
        session={activeSession}
        patient={patient}
        isRecording={captureState === "recording"}
        isTranscribing={isTranscribing}
        sidecarConnected={sidecarConnected}
        audioLevel={audioLevel}
        onStart={handleStartRecording}
        onStop={handleStopRecording}
        onDelete={handleDelete}
      />

      <SessionTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Patient context (read-only) — shown above editor on context tab */}
      {activeTab === "context" && patient?.context && (
        <div className="pt-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Patient Context (read-only)
          </label>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
            {patient.context}
          </div>
        </div>
      )}

      {activeTab === "note" && (
        <div className="flex justify-end pt-4">
          <button
            type="button"
            disabled={!activeSession.rawTranscript || isGenerating}
            onClick={() => {
              if (activeSession.notes && !confirm("This will replace the existing note. Continue?")) return;
              generateNote(activeSession.id, activeSession.rawTranscript ?? "", "");
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-white/60" />
                Generating...
              </span>
            ) : activeSession.notes ? (
              "Regenerate Note"
            ) : (
              "Generate Note"
            )}
          </button>
        </div>
      )}

      <div className="pt-2">
        {activeTab === "transcription" ? (
          <TranscriptPanel
            rawTranscript={activeSession.rawTranscript}
            isTranscribing={isTranscribing}
          />
        ) : (
          <SessionEditor
            key={activeTab}
            initialState={initialState}
            onChange={isReadOnly ? undefined : handleEditorChange}
            readOnly={isReadOnly}
            placeholder={TAB_PLACEHOLDER[activeTab]}
          />
        )}
      </div>
    </div>
  );
}
