import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient } from "../../types";
import type { SerializedEditorState } from "lexical";
import SessionTopBar from "./SessionTopBar";
import SessionTabBar, { type SessionTab } from "./SessionTabBar";
import SessionEditor from "./SessionEditor";
import TranscriptPanel from "./TranscriptPanel";
import NoteToolbar from "./NoteToolbar";
import { useAudioCapture } from "../../hooks/useAudioCapture";
import { useTranscription } from "../../hooks/useTranscription";
import { useNoteGeneration } from "../../hooks/useNoteGeneration";
import { useSidecar } from "../../contexts/SidecarContext";
import { markdownToLexical } from "../../lib/markdown-to-lexical";

/** Extract plain text from a serialized Lexical editor state. */
function extractTextFromLexical(state: SerializedEditorState): string {
  const lines: string[] = [];
  function walk(node: Record<string, unknown>) {
    if (node.type === "text" && typeof node.text === "string") {
      lines.push(node.text);
    }
    if (node.type === "linebreak") {
      lines.push("\n");
    }
    if (node.type === "paragraph" || node.type === "heading") {
      if (lines.length > 0 && lines[lines.length - 1] !== "\n") lines.push("\n");
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child as Record<string, unknown>);
      if (node.type === "paragraph" || node.type === "heading") lines.push("\n");
    }
  }
  walk(state.root as unknown as Record<string, unknown>);
  return lines.join("").trim();
}

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
const STREAM_DEBOUNCE_MS = 200;

export default function SessionView() {
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const mergeActiveSession = useAppStore((s) => s.mergeActiveSession);
  const setView = useAppStore((s) => s.setView);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("context");
  const [error, setError] = useState<string | null>(null);
  const [streamPreview, setStreamPreview] = useState<SerializedEditorState | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    transcript: _transcript,
    isTranscribing,
    error: transcriptionError,
    startTranscription,
    stopTranscription,
    sendAudioChunk,
  } = useTranscription();

  const {
    state: captureState,
    audioLevel,
    start,
    stop,
    error: captureError,
  } = useAudioCapture({ onChunk: sendAudioChunk });

  const {
    isGenerating,
    isStreaming,
    streamingText,
    error: noteError,
    generateNote,
    onNoteGenerated,
  } = useNoteGeneration();

  const { connectionState } = useSidecar();
  const sidecarConnected = connectionState === "connected";

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ sessionId: string; field: string; state: SerializedEditorState } | null>(null);
  const streamingTextRef = useRef(streamingText);
  streamingTextRef.current = streamingText;

  // Reset tab and local state when switching sessions
  useEffect(() => {
    setActiveTab("context");
    setError(null);
    setStreamPreview(null);
    setConfirmRegenerate(false);
    setConfirmDelete(false);
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession?.patientId) {
      setPatient(null);
      return;
    }
    db.getPatient(activeSession.patientId).then(setPatient).catch(() => setPatient(null));
  }, [activeSession?.patientId]);

  // Throttled streaming preview: convert markdown → Lexical at a fixed interval
  // while streaming. Uses a ref so the interval always reads the latest text
  // without re-running the effect on every chunk (which killed the old debounce).
  useEffect(() => {
    if (!isStreaming) {
      setStreamPreview(null);
      return;
    }

    const tick = () => {
      const text = streamingTextRef.current;
      if (text) {
        try {
          setStreamPreview(markdownToLexical(text));
        } catch {
          // Partial markdown may fail to parse — ignore until next tick
        }
      }
    };

    tick();
    const id = setInterval(tick, STREAM_DEBOUNCE_MS);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Save generated note to DB and update store
  useEffect(() => {
    onNoteGenerated(async (content) => {
      if (!activeSession) return;
      try {
        // Sidecar sends markdown (string); legacy data is Lexical JSON (object)
        const lexicalState =
          typeof content === "string"
            ? markdownToLexical(content)
            : (content as SerializedEditorState);
        await db.updateSession(activeSession.id, { notes: lexicalState });
        mergeActiveSession(activeSession.id, { notes: lexicalState });
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
    setActiveTab("transcription");
    startTranscription(activeSession.id);
    await start();
  }, [activeSession, start, startTranscription]);

  const handleStopRecording = useCallback(async () => {
    await stop();
    const text = await stopTranscription();
    if (text && activeSession) {
      try {
        await db.updateSession(activeSession.id, { rawTranscript: text });
        mergeActiveSession(activeSession.id, { rawTranscript: text });
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
          mergeActiveSession(activeSession.id, { [field]: state });
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
    try {
      await db.deleteSession(activeSession.id);
      setActiveSession(null);
      setView("recent-sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  }

  const field = TAB_FIELD[activeTab];
  // While streaming on the note tab, show the live preview; otherwise show persisted state
  const noteIsStreaming = activeTab === "note" && isStreaming && streamPreview;
  const initialState = noteIsStreaming
    ? streamPreview
    : ((activeSession[field] as SerializedEditorState | null) ?? null);
  const isReadOnly = activeTab === "transcription" || (activeTab === "note" && isStreaming);

  return (
    <div className="flex h-full flex-col">
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
        confirmDelete={confirmDelete}
        onDeleteRequest={() => setConfirmDelete(true)}
        onDeleteConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onDeleteCancel={() => setConfirmDelete(false)}
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

      <div className="min-h-0 flex-1 pt-2">
        {activeTab === "transcription" ? (
          <TranscriptPanel
            rawTranscript={activeSession.rawTranscript}
            isTranscribing={isTranscribing}
          />
        ) : (
          <SessionEditor
            key={noteIsStreaming ? `note-streaming` : `${activeSession.id}-${activeTab}`}
            initialState={initialState}
            onChange={isReadOnly ? undefined : handleEditorChange}
            readOnly={isReadOnly}
            placeholder={TAB_PLACEHOLDER[activeTab]}
            header={
              activeTab === "note"
                ? confirmRegenerate
                  ? (
                    <div className="flex items-center justify-end gap-2 px-4 pt-3">
                      <span className="text-sm text-gray-500">Replace existing note?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRegenerate(false);
                          generateNote(activeSession.id, activeSession.rawTranscript ?? "", "");
                        }}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Yes, replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRegenerate(false)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                  : (
                    <NoteToolbar
                      hasNote={!!activeSession.notes}
                      isGenerating={isGenerating}
                      canGenerate={!!activeSession.rawTranscript}
                      onCopy={() => {
                        const notes = activeSession.notes as SerializedEditorState | null;
                        if (!notes) return;
                        try {
                          const text = extractTextFromLexical(notes);
                          navigator.clipboard.writeText(text);
                        } catch (err) {
                          console.error("Failed to copy note:", err);
                        }
                      }}
                      onRegenerate={() => {
                        if (activeSession.notes) {
                          setConfirmRegenerate(true);
                        } else {
                          generateNote(activeSession.id, activeSession.rawTranscript ?? "", "");
                        }
                      }}
                    />
                  )
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
