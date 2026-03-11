import type { Template } from "../../types";

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onChange: (templateId: string | null) => void;
}

export default function TemplateSelector({
  templates,
  selectedTemplateId,
  onChange,
}: TemplateSelectorProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Template (optional)
      </label>
      <select
        value={selectedTemplateId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">None</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.isSystem ? " (System)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
