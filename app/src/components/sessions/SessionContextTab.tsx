import { useState, useEffect } from "react";
import type { Patient, Session } from "../../types";
import * as db from "../../lib/db";

interface SessionContextTabProps {
  session: Session;
  patient: Patient | null;
  onSessionUpdate: (session: Session) => void;
}

export default function SessionContextTab({
  session,
  patient,
  onSessionUpdate,
}: SessionContextTabProps) {
  const contextStr =
    typeof session.context === "string"
      ? session.context
      : session.context
        ? JSON.stringify(session.context)
        : "";
  const [value, setValue] = useState(contextStr);

  useEffect(() => {
    setValue(contextStr);
  }, [session.id]);

  async function handleBlur() {
    if (value === contextStr) return;
    try {
      await db.updateSession(session.id, { context: value || null });
      onSessionUpdate({ ...session, context: value || null });
    } catch (err) {
      console.error("Failed to save context:", err);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      {patient?.context && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Patient Context (read-only)
          </label>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
            {patient.context}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Session Context
        </label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          rows={6}
          placeholder="Add session-specific context..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
