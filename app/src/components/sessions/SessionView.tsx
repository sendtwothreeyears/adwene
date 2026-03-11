import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient, Session } from "../../types";
import SessionTopBar from "./SessionTopBar";
import SessionTabBar, { type SessionTab } from "./SessionTabBar";
import SessionContextTab from "./SessionContextTab";
import SessionTranscriptionTab from "./SessionTranscriptionTab";
import SessionNoteTab from "./SessionNoteTab";

export default function SessionView() {
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setView = useAppStore((s) => s.setView);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("context");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSession?.patientId) {
      setPatient(null);
      return;
    }
    db.getPatient(activeSession.patientId).then(setPatient).catch(() => setPatient(null));
  }, [activeSession?.patientId]);

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

  function handleSessionUpdate(updated: Session) {
    setActiveSession(updated);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <SessionTopBar
        session={activeSession}
        patient={patient}
        onDelete={handleDelete}
      />

      {/* Audio placeholder row */}
      <div className="flex items-center gap-2 border-b border-gray-200 py-3 text-sm text-gray-400">
        Audio controls — coming in Step 4
      </div>

      <SessionTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "context" && (
        <SessionContextTab
          session={activeSession}
          patient={patient}
          onSessionUpdate={handleSessionUpdate}
        />
      )}
      {activeTab === "transcription" && <SessionTranscriptionTab />}
      {activeTab === "note" && <SessionNoteTab />}
    </div>
  );
}
