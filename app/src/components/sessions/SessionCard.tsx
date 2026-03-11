import { Trash2 } from "lucide-react";
import type { Session } from "../../types";
import StatusBadge from "../ui/StatusBadge";

interface SessionCardProps {
  session: Session;
  patientName: string | null;
  onClick: (session: Session) => void;
  onDelete: (session: Session) => void;
}

export default function SessionCard({
  session,
  patientName,
  onClick,
  onDelete,
}: SessionCardProps) {
  const created = new Date(session.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      onClick={() => onClick(session)}
      className="flex cursor-pointer items-center justify-between rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">
            {patientName ?? "No patient"}
          </p>
          <StatusBadge status={session.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {created}
          {session.summary && (
            <span className="ml-3">{session.summary}</span>
          )}
        </p>
      </div>

      <div className="ml-3 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session);
          }}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Delete session"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
