import type { SessionStatus } from "../../types";

const styles: Record<SessionStatus, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  FINALIZED: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-800",
};

interface StatusBadgeProps {
  status: SessionStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
