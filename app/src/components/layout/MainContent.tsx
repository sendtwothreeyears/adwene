import { useAppStore } from "../../stores/appStore";
import RecordsView from "../patients/RecordsView";
import SessionView from "../sessions/SessionView";
import RecentSessionsView from "../sessions/RecentSessionsView";
import TemplatesView from "../templates/TemplatesView";

export default function MainContent() {
  const currentView = useAppStore((s) => s.currentView);

  return (
    <main className="flex-1 overflow-auto bg-white p-6">
      {currentView === "records" && <RecordsView />}
      {currentView === "current-session" && <SessionView />}
      {currentView === "templates" && <TemplatesView />}
      {currentView === "recent-sessions" && <RecentSessionsView />}
    </main>
  );
}
