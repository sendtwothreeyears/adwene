import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Session, Patient, SessionStatus } from "../../types";
import SearchInput from "../ui/SearchInput";
import SessionCard from "./SessionCard";

type StatusFilter = "ALL" | SessionStatus;

export default function RecentSessionsView() {
  const providerId = useAppStore((s) => s.providerId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setView = useAppStore((s) => s.setView);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;
    let ignore = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [sessionList, patientList] = await Promise.all([
          db.listSessions(providerId!),
          db.listPatients(providerId!),
        ]);
        if (ignore) return;
        setSessions(sessionList);
        const patientMap: Record<string, Patient> = {};
        for (const p of patientList) {
          patientMap[p.id] = p;
        }
        setPatients(patientMap);
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, [providerId]);

  const filtered = useMemo(() => {
    let result = sessions;

    if (statusFilter !== "ALL") {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const patient = s.patientId ? patients[s.patientId] : null;
        const name = patient
          ? `${patient.firstName} ${patient.lastName}`.toLowerCase()
          : "";
        return (
          name.includes(q) ||
          (s.summary && s.summary.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [sessions, patients, search, statusFilter]);

  function getPatientName(session: Session): string | null {
    if (!session.patientId) return null;
    const p = patients[session.patientId];
    return p ? `${p.firstName} ${p.lastName}` : null;
  }

  function handleOpen(session: Session) {
    setActiveSession(session);
    setView("current-session");
  }

  async function handleDelete(session: Session) {
    try {
      await db.deleteSession(session.id);
      // Reload inline (no stale concern — user-triggered)
      if (!providerId) return;
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
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900 font-gtsuper">Recent Sessions</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by patient name or summary..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="ALL">All</option>
          <option value="DRAFT">Draft</option>
          <option value="COMPLETED">Completed</option>
          <option value="FINALIZED">Finalized</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {sessions.length === 0 ? "No sessions yet" : "No sessions match your filters"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              patientName={getPatientName(session)}
              onClick={handleOpen}
              confirmingDelete={deletingId === session.id}
              onDelete={(s) => {
                if (deletingId === s.id) {
                  setDeletingId(null);
                  handleDelete(s);
                } else {
                  setDeletingId(s.id);
                }
              }}
              onDeleteCancel={() => setDeletingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
