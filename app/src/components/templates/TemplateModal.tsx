import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import type { SerializedEditorState } from "lexical";
import type { Template } from "../../types";
import TemplateEditor from "./TemplateEditor";
import TemplateInstructionsSidebar from "./TemplateInstructionsSidebar";
import TagInput from "../ui/TagInput";
import * as db from "../../lib/db";

interface TemplateModalProps {
  template?: Template | null;
  readOnly?: boolean;
  onSave: (data: {
    name: string;
    description: string | null;
    content: SerializedEditorState;
    tags: string[];
  }) => void | Promise<void>;
  onClose: () => void;
}

export default function TemplateModal({
  template,
  readOnly = false,
  onSave,
  onClose,
}: TemplateModalProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [content, setContent] = useState<SerializedEditorState | null>(
    (template?.content as SerializedEditorState) ?? null,
  );
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isHelperOpen, setIsHelperOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = !!template;
  const isCreate = !isEdit;
  const showSidebar = isCreate;

  useEffect(() => {
    async function loadTags() {
      try {
        const allTags = await db.getAllTags();
        setTagSuggestions(allTags.map((t) => t.name));
        if (template?.id) {
          const existing = await db.getTagsForTemplate(template.id);
          setTags(existing.map((t) => t.name));
        }
      } catch {
        // Tags are non-critical
      }
    }
    loadTags();
  }, [template?.id]);

  const handleTagSearch = useCallback(async (query: string) => {
    try {
      const results = query
        ? await db.searchTags(query)
        : await db.getAllTags();
      setTagSuggestions(results.map((t) => t.name));
    } catch {
      // ignore
    }
  }, []);

  const hasContent = content && content.root?.children?.length > 0;
  const canSave = !readOnly && !saving && !!name.trim() && hasContent;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!canSave || !content) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        content,
        tags,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }, [canSave, content, name, description, tags, onSave]);

  // Shared editor column used in both layouts
  const editorColumn = (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title and description */}
      <div className="border-b border-gray-100 px-6 pb-4 pt-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={readOnly}
          className="mb-3 w-full border-none text-3xl font-semibold outline-none focus:ring-0 font-gtsuper"
          placeholder="Untitled template"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          readOnly={readOnly}
          className="w-full border-none text-base text-gray-600 outline-none placeholder:text-gray-400 focus:ring-0"
          placeholder="Description (optional) — e.g., For routine adult primary care visits"
        />
      </div>

      {/* Editor — scrolls */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-4">
        <TemplateEditor
          initialState={
            (template?.content as SerializedEditorState) ?? null
          }
          onChange={readOnly ? undefined : setContent}
          readOnly={readOnly}
          placeholder="Start typing your template..."
        />
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex w-full h-[85vh] mx-6 flex-col overflow-hidden rounded-xl bg-white shadow-2xl font-fakt"
        style={{ maxHeight: "90%", maxWidth: "90%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>&rsaquo;</span>
            <span>
              {readOnly
                ? template?.name ?? "View template"
                : isEdit
                  ? "Edit template"
                  : "Create template"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {saveError && (
          <div className="mx-6 mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {saveError}
          </div>
        )}

        {/* Content area — with sidebar for create, without for edit/view */}
        {showSidebar ? (
          <div className="relative flex flex-1 overflow-hidden">
            {editorColumn}
            {/* Open instructions — always present, sidebar slides over it */}
            <button
              onClick={() => setIsHelperOpen(true)}
              className="absolute right-4 flex cursor-pointer items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
              style={{ top: 32 }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="10" y1="8" x2="7" y2="12" />
                <line x1="10" y1="16" x2="7" y2="12" />
              </svg>
              <span className="text-sm">Open instructions</span>
            </button>
            <TemplateInstructionsSidebar
              isOpen={isHelperOpen}
              onToggle={() => setIsHelperOpen((o) => !o)}
            />
          </div>
        ) : (
          editorColumn
        )}

        {/* Footer */}
        <div className="flex items-center border-t border-gray-200 px-6 py-4 gap-4">
          {!readOnly && (
            <div className="flex-1 min-w-0">
              <TagInput
                tags={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                onSearch={handleTagSearch}
                readOnly={readOnly}
                placeholder="Add tags (press Tab to create)…"
              />
            </div>
          )}
          <div className="ml-auto shrink-0">
            {readOnly ? (
              <button
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`rounded-lg px-6 py-2 font-semibold transition-colors ${
                  canSave
                    ? "cursor-pointer bg-button text-white hover:bg-button-hover"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
