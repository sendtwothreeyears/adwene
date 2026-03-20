import {
  FolderOpen,
  FileText,
  Plus,
  ChevronRight,
  ChevronLeft,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAppStore, type AppView } from "../../stores/appStore";
import * as db from "../../lib/db";
import { useSidecar } from "../../hooks/useSidecar";

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { view: "records", label: "Records", icon: <FolderOpen className="h-4 w-4" /> },
  { view: "templates", label: "Templates", icon: <FileText className="h-4 w-4" /> },
];

export default function Sidebar() {
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setCreatingSession = useAppStore((s) => s.setCreatingSession);
  const providerId = useAppStore((s) => s.providerId);
  const providerName = useAppStore((s) => s.providerName) ?? "Provider";
  const providerEmail = useAppStore((s) => s.providerEmail) ?? "";
  const providerPhotoUrl = useAppStore((s) => s.providerPhotoUrl);
  const scribePanelOpen = useAppStore((s) => s.scribePanelOpen);
  const toggleScribePanel = useAppStore((s) => s.toggleScribePanel);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const logout = useAppStore((s) => s.logout);
  const { connectionState } = useSidecar();

  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!providerMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (providerMenuRef.current && !providerMenuRef.current.contains(e.target as Node)) {
        setProviderMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setProviderMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [providerMenuOpen]);

  async function handleCreateSession() {
    if (!providerId) return;
    setCreatingSession(true);
    setView("session");
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

  function handleScribeClick() {
    toggleScribePanel();
  }

  const initials = providerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isScribeActive = scribePanelOpen;

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg font-fakt transition-all duration-200 ease-out ${
        sidebarCollapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center pt-5 pb-4 ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        {!sidebarCollapsed && (
          <img src="/icons/kasamd_green.png" className="h-8" alt="KasaMD" />
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1 text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
      <hr className={`border-sidebar-border ${sidebarCollapsed ? "mx-2" : "mx-4"}`} />

      {/* Create Session button */}
      <div className={sidebarCollapsed ? "px-2 pb-4" : "px-3 pb-4"}>
        <button
          onClick={handleCreateSession}
          title="New Session"
          className={`flex w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-white hover:bg-primary-dark transition-colors ${
            sidebarCollapsed ? "px-2 py-2" : "gap-2 px-3 py-2"
          }`}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && "New Session"}
        </button>
      </div>

      {/* Nav items */}
      <nav className={`space-y-0.5 ${sidebarCollapsed ? "px-2" : "px-3"}`}>
        {/* Scribe toggle */}
        <button
          onClick={handleScribeClick}
          title="Scribe"
          className={`flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${
            sidebarCollapsed ? "justify-center" : "justify-between"
          } ${
            isScribeActive
              ? "bg-sidebar-selected font-medium text-sidebar-selected-text"
              : "text-sidebar-text hover:bg-sidebar-hover"
          }`}
        >
          {sidebarCollapsed ? (
            <Mic className="h-4 w-4" />
          ) : (
            <>
              <span className="flex items-center gap-3">
                <Mic className="h-4 w-4" />
                Scribe
              </span>
              {isScribeActive && scribePanelOpen ? (
                <ChevronLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </>
          )}
        </button>

        {/* Standard nav items */}
        {navItems.map((item) => {
          const isActive = currentView === item.view;

          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              title={item.label}
              className={`flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${
                sidebarCollapsed ? "justify-center" : "gap-3"
              } ${
                isActive
                  ? "bg-sidebar-selected font-medium text-sidebar-selected-text"
                  : "text-sidebar-text hover:bg-sidebar-hover"
              }`}
            >
              {item.icon}
              {!sidebarCollapsed && item.label}
            </button>
          );
        })}

      </nav>

      {/* Settings — own section with spacing from main nav */}
      <div className={`pt-6 pb-2 ${sidebarCollapsed ? "px-2" : "px-3"}`}>
        <button
          onClick={() => setView("settings")}
          title="Settings"
          className={`flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${
            sidebarCollapsed ? "justify-center" : "gap-3"
          } ${
            currentView === "settings"
              ? "bg-sidebar-selected font-medium text-sidebar-selected-text"
              : "text-sidebar-text hover:bg-sidebar-hover"
          }`}
        >
          <Settings className="h-4 w-4" />
          {!sidebarCollapsed && "Settings"}
        </button>
      </div>

      {/* Spacer pushes sidecar status + provider to bottom */}
      <div className="flex-1" />

      {/* Sidecar status */}
      <div className={sidebarCollapsed ? "flex justify-center py-2" : "px-4 py-2"}>
        {sidebarCollapsed ? (
          <span
            title={
              connectionState === "connected"
                ? "Sidecar connected"
                : connectionState === "connecting"
                  ? "Connecting..."
                  : "Sidecar offline"
            }
            className={`h-2 w-2 rounded-full ${
              connectionState === "connected"
                ? "bg-green-500"
                : connectionState === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-400"
            }`}
          />
        ) : (
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
        )}
      </div>

      {/* Provider info — clickable, opens popover menu */}
      <div ref={providerMenuRef} className="relative">
        {/* Popover menu */}
        {providerMenuOpen && (
          <div
            className={`absolute bottom-full mb-1 z-50 rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
              sidebarCollapsed ? "left-1/2 -translate-x-1/2 w-48" : "left-2 right-2"
            }`}
          >
            {/* Provider header */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100">
              {providerPhotoUrl ? (
                <img
                  src={providerPhotoUrl}
                  alt={providerName}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {providerName}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {providerEmail}
                </p>
              </div>
            </div>

            {/* Menu items */}
            <button
              onClick={() => {
                setView("settings");
                setProviderMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-4 w-4 text-gray-400" />
              Settings
            </button>
            <button
              onClick={() => {
                logout();
                setProviderMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="h-4 w-4 text-gray-400" />
              Log out
            </button>
          </div>
        )}

        {/* Provider trigger button */}
        <button
          onClick={() => setProviderMenuOpen(!providerMenuOpen)}
          title={sidebarCollapsed ? providerName : undefined}
          className={`w-full border-t border-sidebar-border text-left transition-colors hover:bg-sidebar-hover cursor-pointer ${
            sidebarCollapsed ? "flex justify-center py-3" : "px-4 py-3"
          }`}
        >
          {sidebarCollapsed ? (
            providerPhotoUrl ? (
              <img
                src={providerPhotoUrl}
                alt={providerName}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {initials}
              </div>
            )
          ) : (
            <div className="flex items-center gap-3">
              {providerPhotoUrl ? (
                <img
                  src={providerPhotoUrl}
                  alt={providerName}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-text">
                  {providerName}
                </p>
                <p className="truncate text-xs text-sidebar-text-muted">
                  {providerEmail}
                </p>
              </div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
