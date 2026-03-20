import { useState, useMemo } from "react";
import type { Template } from "../../types";
import Modal from "../ui/Modal";
import SearchInput from "../ui/SearchInput";

interface TemplateSelectorModalProps {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  selectedTemplateId: string | null;
  onSelect: (templateId: string | null) => void;
}

function TemplateRow({
  template: t,
  isSelected,
  onSelect,
}: {
  template: Template;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t.id)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? "bg-primary/10 text-gray-900"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <svg
        className="h-4 w-4 shrink-0 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
        />
      </svg>
      <span className="text-sm font-medium truncate">{t.name}</span>
    </button>
  );
}

export default function TemplateSelectorModal({
  open,
  onClose,
  templates,
  selectedTemplateId,
  onSelect,
}: TemplateSelectorModalProps) {
  const [search, setSearch] = useState("");

  const { systemTemplates, customTemplates } = useMemo(() => {
    let list = templates;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    return {
      systemTemplates: list.filter((t) => t.isSystem),
      customTemplates: list.filter((t) => !t.isSystem),
    };
  }, [templates, search]);

  const hasResults = systemTemplates.length > 0 || customTemplates.length > 0;

  function handleSelect(id: string | null) {
    onSelect(id);
    onClose();
    setSearch("");
  }

  return (
    <Modal open={open} onClose={onClose} title="Select Template">
      <div className="mb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates..."
        />
      </div>

      <div className="max-h-[400px] overflow-y-auto -mx-2">
        {/* None option */}
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            selectedTemplateId === null
              ? "bg-primary/10 text-gray-900"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span className="text-sm font-medium">None</span>
        </button>

        {/* System templates section */}
        {systemTemplates.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                System templates
              </span>
            </div>
            {systemTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                isSelected={selectedTemplateId === t.id}
                onSelect={handleSelect}
              />
            ))}
          </>
        )}

        {/* Custom templates section */}
        {customTemplates.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                My templates
              </span>
            </div>
            {customTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                isSelected={selectedTemplateId === t.id}
                onSelect={handleSelect}
              />
            ))}
          </>
        )}

        {!hasResults && (
          <p className="py-8 text-center text-sm text-gray-400">
            No templates match your search
          </p>
        )}
      </div>
    </Modal>
  );
}
