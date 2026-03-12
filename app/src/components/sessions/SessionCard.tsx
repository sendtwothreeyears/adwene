import { Trash2 } from "lucide-react";
import type { Session } from "../../types";
import StatusBadge from "../ui/StatusBadge";

interface SessionCardProps {
  session: Session;
  patientName: string | null;
  onClick: (session: Session) => void;
  onDelete: (session: Session) => void;
  confirmingDelete?: boolean;
  onDeleteCancel?: () => void;
}

export default function SessionCard({
  session,
  patientName,
  onClick,
  onDelete,
  confirmingDelete,
  onDeleteCancel,
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
      onClick={() => !confirmingDelete && onClick(session)}
      className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-shadow ${
        confirmingDelete
          ? "border-red-200 bg-red-50"
          : "cursor-pointer border-gray-200 hover:shadow-md"
      }`}
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

      <div className="ml-3 flex shrink-0 items-center gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-sm text-gray-500">Delete?</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session);
              }}
              className="rounded-md bg-red-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-red-700"
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCancel?.();
              }}
              className="rounded-md px-2.5 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              No
            </button>
          </>
        ) : (
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
        )}
      </div>
    </div>
  );
}
