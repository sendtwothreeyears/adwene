import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, MoreVertical, X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Template } from "../../types";
import type { SerializedEditorState } from "lexical";
import Modal from "../ui/Modal";
import TemplateEditor from "./TemplateEditor";

export default function TemplatesView() {
  const providerId = useAppStore((s) => s.providerId);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View modal
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createContent, setCreateContent] = useState<SerializedEditorState | null>(null);
  const [creating, setCreating] = useState(false);

  // Menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      setError(null);
      const list = await db.listTemplates(providerId);
      setTemplates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpenId]);

  async function handleDelete(template: Template) {
    if (template.isSystem) return;
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await db.deleteTemplate(template.id);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  }

  function handleOpenCreate() {
    setCreateName("");
    setCreateDescription("");
    setCreateContent(null);
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!providerId || !createName.trim() || !createContent) return;
    try {
      setCreating(true);
      setError(null);
      await db.createTemplate({
        name: createName.trim(),
        description: createDescription.trim() || null,
        content: createContent,
        isSystem: false,
        providerId,
      });
      setShowCreate(false);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Template grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No templates yet. Click "Create Template" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setViewingTemplate(template)}
              className="relative flex cursor-pointer flex-col justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:shadow-sm"
            >
              {/* Three-dot menu */}
              {!template.isSystem && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(
                        menuOpenId === template.id ? null : template.id,
                      );
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpenId === template.id && (
                    <div className="absolute right-0 mt-1 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          handleDelete(template);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Card content */}
              <div className="pr-6">
                <h3 className="text-sm font-semibold text-gray-900">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                    {template.description}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Updated {formatDate(template.updatedAt)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    template.isSystem
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {template.isSystem ? "Adwene Default" : "Custom"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View template modal */}
      {viewingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setViewingTemplate(null)}
        >
          <div
            className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-6 pt-6 pb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewingTemplate.name}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      viewingTemplate.isSystem
                        ? "bg-primary/10 text-primary"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {viewingTemplate.isSystem ? "Adwene Default" : "Custom"}
                  </span>
                </div>
                {viewingTemplate.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {viewingTemplate.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewingTemplate(null)}
                className="ml-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Template content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <TemplateEditor
                initialState={viewingTemplate.content as SerializedEditorState}
                readOnly
              />
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <span className="text-xs text-gray-400">
                Updated {formatDate(viewingTemplate.updatedAt)}
              </span>
              <button
                onClick={() => setViewingTemplate(null)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create template modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Template"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Follow-Up Visit"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <input
              type="text"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Brief description of this template"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Content
            </label>
            <TemplateEditor
              initialState={null}
              onChange={setCreateContent}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!createName.trim() || !createContent || creating}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Template"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
