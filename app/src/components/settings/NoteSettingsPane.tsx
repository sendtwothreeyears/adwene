import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Template } from "../../types";

export default function NoteSettingsPane() {
  const providerId = useAppStore((s) => s.providerId);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      const [provider, templateList] = await Promise.all([
        db.getProvider(),
        db.listTemplates(providerId),
      ]);
      setTemplates(templateList);
      setSelectedId(provider?.defaultTemplateId ?? null);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleChange(templateId: string | null) {
    if (!providerId) return;
    setSelectedId(templateId);
    await db.updateProvider(providerId, { defaultTemplateId: templateId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-lg">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Default Template</h2>
      <p className="mb-4 text-sm text-gray-500">
        New sessions will use this template by default.
      </p>

      <select
        value={selectedId ?? ""}
        onChange={(e) => handleChange(e.target.value || null)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-400 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">None</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {saved && (
        <p className="mt-2 text-sm text-green-600">Saved</p>
      )}
    </div>
  );
}
