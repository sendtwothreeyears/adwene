import { useAppStore } from "../../stores/appStore";
import RecordsView from "../patients/RecordsView";
import SessionView from "../sessions/SessionView";
import RecentSessionsView from "../sessions/RecentSessionsView";
import TemplatesView from "../templates/TemplatesView";

export default function MainContent() {
  const currentView = useAppStore((s) => s.currentView);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-body p-4 font-fakt">
      {currentView === "records" && <RecordsView />}
      {currentView === "current-session" && <SessionView />}
      {currentView === "templates" && <TemplatesView />}
      {currentView === "recent-sessions" && <RecentSessionsView />}
    </main>
  );
}
