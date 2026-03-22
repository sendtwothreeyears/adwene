import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  UserRound,
  Check,
  Trash2,
  CheckCheck,
  ListFilter,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Session, Patient } from "../../types";
import ScribePanelSortPopover, {
  type SortField,
  type SortDirection,
} from "./ScribePanelSortPopover";
import ScribePanelFilterPopover, {
  type DateFilter,
} from "./ScribePanelFilterPopover";

/** Group sessions by date label in MM/DD/YYYY format. */
function getDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ScribePanel() {
  const providerId = useAppStore((s) => s.providerId);
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setView = useAppStore((s) => s.setView);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showSortPopover, setShowSortPopover] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "all" });
  const [patientFilter, setPatientFilter] = useState<Set<string>>(new Set());
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  const selectionMode = selectedIds.size > 0;

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      const [sessionList, patientList] = await Promise.all([
        db.listSessions(providerId),
        db.listPatients(providerId),
      ]);
      setSessions(sessionList);
      const patientMap: Record<string, Patient> = {};
      for (const p of patientList) {
        patientMap[p.id] = p;
      }
      setPatients(patientMap);
    } catch (err) {
      console.error("ScribePanel: failed to load sessions", err);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // Load on mount and when activeSession changes (catches creates/deletes)
  useEffect(() => {
    loadData();
  }, [loadData, activeSession?.id]);

  const filtered = useMemo(() => {
    let result = sessions;

    // Apply date filter
    if (dateFilter.type === "preset") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dateFilter.days);
      result = result.filter((s) => new Date(s.createdAt) >= cutoff);
    } else if (dateFilter.type === "custom") {
      const start = dateFilter.start;
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((s) => {
        const d = new Date(s.createdAt);
        return d >= start && d <= end;
      });
    }

    // Apply patient filter
    if (patientFilter.size > 0) {
      result = result.filter(
        (s) => s.patientId !== null && patientFilter.has(s.patientId)
      );
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const patient = s.patientId ? patients[s.patientId] : null;
        const name = patient
          ? `${patient.firstName} ${patient.lastName}`.toLowerCase()
          : "";
        return (
          (s.title && s.title.toLowerCase().includes(q)) ||
          name.includes(q) ||
          (s.summary && s.summary.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [sessions, patients, search, dateFilter, patientFilter]);

  // Sort filtered sessions
  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDirection === "asc" ? 1 : -1;

    function sessionName(s: Session): string {
      if (s.title) return s.title.toLowerCase();
      if (s.patientId) {
        const p = patients[s.patientId];
        if (p) return `${p.firstName} ${p.lastName}`.toLowerCase();
      }
      return "";
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "createdAt":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        case "updatedAt":
          cmp = a.updatedAt.localeCompare(b.updatedAt);
          break;
        case "name":
          cmp = sessionName(a).localeCompare(sessionName(b));
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return cmp * dir;
    });
    return list;
  }, [filtered, sortField, sortDirection, patients]);

  // Group sorted sessions by date
  const grouped = useMemo(() => {
    const groups: { label: string; sessions: Session[] }[] = [];
    let currentLabel = "";
    const dateField = sortField === "updatedAt" ? "updatedAt" : "createdAt";
    for (const session of sorted) {
      const label = getDateLabel(session[dateField]);
      if (label !== currentLabel) {
        groups.push({ label, sessions: [session] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].sessions.push(session);
      }
    }
    return groups;
  }, [sorted, sortField]);

  function getPatientName(session: Session): string | null {
    if (!session.patientId) return null;
    const p = patients[session.patientId];
    return p ? `${p.firstName} ${p.lastName}` : null;
  }

  function toggleSelection(sessionId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
    setConfirmDelete(false);
  }

  function handleSelectAll() {
    const allIds = filtered.map((s) => s.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
    setConfirmDelete(false);
  }

  async function handleBulkDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      for (const id of selectedIds) {
        await db.deleteSession(id);
      }
      // Clear active session if it was among deleted
      if (activeSession && selectedIds.has(activeSession.id)) {
        setActiveSession(null);
      }
      setSelectedIds(new Set());
      setConfirmDelete(false);
      await loadData();
    } catch (err) {
      console.error("Failed to bulk delete sessions:", err);
    }
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-gray-200 bg-white font-fakt">
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 px-3 pb-2">
        <button
          ref={filterBtnRef}
          onClick={() => {
            setShowFilterPopover((v) => !v);
            setShowSortPopover(false);
          }}
          className={`rounded-md p-1.5 transition-colors ${
            showFilterPopover || dateFilter.type !== "all" || patientFilter.size > 0
              ? "bg-gray-100 text-gray-700"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          title="Filter"
        >
          <ListFilter className="h-4 w-4" />
        </button>
        {showFilterPopover && (
          <ScribePanelFilterPopover
            anchorEl={filterBtnRef.current}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            patients={patients}
            patientFilter={patientFilter}
            onPatientFilterChange={setPatientFilter}
            onClose={() => setShowFilterPopover(false)}
          />
        )}
        <button
          ref={sortBtnRef}
          onClick={() => {
            setShowSortPopover((v) => !v);
            setShowFilterPopover(false);
          }}
          className={`rounded-md p-1.5 transition-colors ${
            showSortPopover || sortField !== "createdAt" || sortDirection !== "desc"
              ? "bg-gray-100 text-gray-700"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          title="Sort"
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
        {showSortPopover && (
          <ScribePanelSortPopover
            anchorEl={sortBtnRef.current}
            field={sortField}
            direction={sortDirection}
            onFieldChange={setSortField}
            onDirectionChange={setSortDirection}
            onClose={() => setShowSortPopover(false)}
          />
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Session list */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <p className="py-8 text-center text-xs text-gray-400">Loading...</p>
        ) : grouped.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            {sessions.length === 0 ? "No sessions yet" : "No results"}
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              {/* Date header */}
              <div className="sticky top-0 bg-white px-3 py-1.5 text-xs font-medium text-gray-500">
                {group.label}
              </div>

              {/* Session rows */}
              {group.sessions.map((session) => {
                const name = getPatientName(session);
                const isActive = session.id === activeSession?.id;
                const isSelected = selectedIds.has(session.id);
                const initials = name ? getInitials(name) : null;

                return (
                  <div
                    key={session.id}
                    className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/5"
                        : isActive
                          ? "bg-primary/10"
                          : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelection(session.id);
                      } else {
                        setActiveSession(session);
                        setView("session");
                      }
                    }}
                  >
                    {/* Avatar — always visible */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        isActive
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {initials ?? <UserRound className="h-4 w-4" />}
                    </div>

                    {/* Name + time */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          isActive ? "font-medium text-gray-900" : "text-gray-700"
                        }`}
                      >
                        {session.title ?? name ?? "Untitled session"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(session.createdAt)}
                      </p>
                    </div>

                    {/* Checkbox — right side, hover-to-reveal or always visible in selection mode */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(session.id);
                      }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white text-transparent hover:border-gray-400"
                      } ${
                        selectionMode
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Bottom action bar — visible when 1+ selected */}
      {selectionMode && (
        <div className="border-t border-gray-200 bg-white px-3 py-2 space-y-1">
          <button
            onClick={handleSelectAll}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            onClick={handleBulkDelete}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-700"
                : "text-red-600 hover:bg-red-50"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            {confirmDelete
              ? `Confirm delete (${selectedIds.size})`
              : `Delete selected (${selectedIds.size})`}
          </button>
        </div>
      )}
    </div>
  );
}
