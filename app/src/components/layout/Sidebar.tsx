import {
  Mic,
  FolderOpen,
  FileText,
  Clock,
  Plus,
} from "lucide-react";
import { useAppStore, type AppView } from "../../stores/appStore";
import * as db from "../../lib/db";
import { useSidecar } from "../../hooks/useSidecar";

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { view: "current-session", label: "Current Session", icon: <Mic className="h-4 w-4" /> },
  { view: "records", label: "Records", icon: <FolderOpen className="h-4 w-4" /> },
  { view: "templates", label: "Templates", icon: <FileText className="h-4 w-4" /> },
  { view: "recent-sessions", label: "Recent Sessions", icon: <Clock className="h-4 w-4" /> },
];

interface SidebarProps {
  providerName: string;
  providerEmail: string;
}

export default function Sidebar({ providerName, providerEmail }: SidebarProps) {
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const providerId = useAppStore((s) => s.providerId);
  const { connectionState } = useSidecar();

  async function handleCreateSession() {
    if (!providerId) return;
    const session = await db.createSession({
      status: "DRAFT",
      providerId,
      patientId: null,
      templateId: null,
      transcript: null,
      rawTranscript: null,
      notes: null,
      summary: null,
      context: null,
      preview: null,
    });
    setActiveSession(session);
    setView("current-session");
  }

  const initials = providerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg font-fakt">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <img src="/icons/kasamd_green.png" className="h-8" alt="KasaMD" />
      </div>
      <hr className="mx-4 border-sidebar-border" />

      {/* Create Session button */}
      <div className="px-3 pb-4">
        <button
          onClick={handleCreateSession}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Session
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const isDisabled = item.view === "current-session" && !activeSession;

          return (
            <button
              key={item.view}
              onClick={() => !isDisabled && setView(item.view)}
              disabled={isDisabled}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-selected font-medium text-sidebar-selected-text"
                  : isDisabled
                    ? "cursor-not-allowed text-sidebar-text-muted"
                    : "text-sidebar-text hover:bg-sidebar-hover"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sidecar status */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-sidebar-text-muted">
          <span
            className={`h-2 w-2 rounded-full ${
              connectionState === "connected"
                ? "bg-green-500"
                : connectionState === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-400"
            }`}
          />
          {connectionState === "connected"
            ? "Sidecar connected"
            : connectionState === "connecting"
              ? "Connecting..."
              : "Sidecar offline"}
        </div>
      </div>

      {/* Provider info */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-text">
              {providerName}
            </p>
            <p className="truncate text-xs text-sidebar-text-muted">
              {providerEmail}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
