import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import RecordsView from "../patients/RecordsView";
import SessionView from "../sessions/SessionView";
import TemplatesView from "../templates/TemplatesView";
import SettingsView from "../settings/SettingsView";
import SessionSkeleton from "../ui/SessionSkeleton";
import { Plus } from "lucide-react";

export default function MainContent() {
  const currentView = useAppStore((s) => s.currentView);
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const creatingSession = useAppStore((s) => s.creatingSession);
  const setCreatingSession = useAppStore((s) => s.setCreatingSession);
  const providerId = useAppStore((s) => s.providerId);

  async function handleCreateSession() {
    if (!providerId) return;
    setCreatingSession(true);
    const start = Date.now();
    try {
      const session = await db.createSession({
        status: "DRAFT",
        providerId,
        patientId: null,
        templateId: null,
        title: null,
        transcript: null,
        rawTranscript: null,
        notes: null,
        summary: null,
        context: null,
        preview: null,
      });
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 300 - elapsed);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setActiveSession(session);
    } finally {
      setCreatingSession(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-body p-4 font-fakt">
      {currentView === "records" && <RecordsView />}
      {currentView === "session" && creatingSession && <SessionSkeleton />}
      {currentView === "session" && !creatingSession && activeSession && <SessionView />}
      {currentView === "session" && !creatingSession && !activeSession && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-400">
          <p className="text-lg">Select a session or create a new one</p>
          <button
            onClick={handleCreateSession}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
        </div>
      )}
      {currentView === "templates" && <TemplatesView />}
      {currentView === "settings" && <SettingsView />}
    </main>
  );
}
