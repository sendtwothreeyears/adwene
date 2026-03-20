import { useEffect } from "react";
import Sidebar from "./Sidebar";
import ScribePanel from "./ScribePanel";
import MainContent from "./MainContent";
import CreateSessionModal from "../sessions/CreateSessionModal";
import { SidecarProvider } from "../../contexts/SidecarContext";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";

export default function AppLayout() {
  const scribePanelOpen = useAppStore((s) => s.scribePanelOpen);
  const providerId = useAppStore((s) => s.providerId);
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setCreatingSession = useAppStore((s) => s.setCreatingSession);

  // On mount: load most recent session or create a new one
  useEffect(() => {
    if (!providerId || activeSession) return;

    async function initSession() {
      try {
        const sessions = await db.listSessions(providerId!);
        if (sessions.length > 0) {
          // Load the most recent session
          setActiveSession(sessions[0]);
        } else {
          // No sessions — create a DRAFT so user lands in the editor
          setCreatingSession(true);
          const start = Date.now();
          try {
            const session = await db.createSession({
              status: "DRAFT",
              providerId: providerId!,
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
      } catch (err) {
        console.error("Failed to initialize session:", err);
      }
    }

    initSession();
  }, [providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SidecarProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div
          className={`shrink-0 overflow-hidden transition-all duration-200 ease-out ${
            scribePanelOpen ? "w-[280px]" : "w-0"
          }`}
        >
          <div className="w-[280px] h-full">
            <ScribePanel />
          </div>
        </div>
        <MainContent />
        <CreateSessionModal />
      </div>
    </SidecarProvider>
  );
}
