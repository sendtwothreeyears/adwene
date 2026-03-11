import {
  Mic,
  FolderOpen,
  FileText,
  Clock,
  Plus,
} from "lucide-react";
import { useAppStore, type AppView } from "../../stores/appStore";

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
  const openSessionForm = useAppStore((s) => s.openSessionForm);

  const initials = providerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <span className="text-xl font-bold text-primary">Adwene</span>
      </div>

      {/* Create Session button */}
      <div className="px-3 pb-4">
        <button
          onClick={openSessionForm}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
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
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm ${
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : isDisabled
                    ? "cursor-not-allowed text-sidebar-text-muted"
                    : "text-sidebar-text hover:bg-gray-100"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

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
