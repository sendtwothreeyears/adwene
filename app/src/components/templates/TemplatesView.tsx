import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, Pencil, Copy, Star, Upload, MoreHorizontal, Search } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Template } from "../../types";
import type { SerializedEditorState } from "lexical";
import TemplateModal from "./TemplateModal";
import ConfirmModal from "../ui/ConfirmModal";

type FilterTab = "all" | "system" | "custom";

export default function TemplatesView() {
  const providerId = useAppStore((s) => s.providerId);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit/view modal
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Menu & delete confirmation
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);

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

  // Close menu on outside click (use mousedown to avoid race with the opening click)
  useEffect(() => {
    if (!menuOpenId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-menu-container]")) return;
      setMenuOpenId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpenId]);

  const filteredTemplates = useMemo(() => {
    let list = templates;

    // Tab filter
    if (activeTab === "system") list = list.filter((t) => t.isSystem);
    else if (activeTab === "custom") list = list.filter((t) => !t.isSystem);

    // Search filter
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [templates, searchQuery, activeTab]);

  const favouriteTemplates = useMemo(
    () => templates.filter((t) => t.isFavourite),
    [templates],
  );

  async function handleDeleteConfirm() {
    if (!deletingTemplate) return;
    try {
      await db.deleteTemplate(deletingTemplate.id);
      setDeletingTemplate(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
      setDeletingTemplate(null);
    }
  }

  async function handleCreateSave(data: {
    name: string;
    description: string | null;
    content: SerializedEditorState;
    tags: string[];
  }) {
    if (!providerId) return;
    try {
      setError(null);
      const template = await db.createTemplate({
        name: data.name,
        description: data.description,
        content: data.content,
        isSystem: false,
        providerId,
      });
      if (data.tags.length > 0) {
        await db.setTagsForTemplate(template.id, data.tags);
      }
      setShowCreate(false);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    }
  }

  async function handleEditSave(data: {
    name: string;
    description: string | null;
    content: SerializedEditorState;
    tags: string[];
  }) {
    if (!editingTemplate) return;
    try {
      setError(null);
      await db.updateTemplate(editingTemplate.id, {
        name: data.name,
        description: data.description,
        content: data.content,
      });
      await db.setTagsForTemplate(editingTemplate.id, data.tags);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    }
  }

  async function handleDuplicate(template: Template) {
    if (!providerId) return;
    try {
      setError(null);
      const created = await db.createTemplate({
        name: `${template.name} (Copy)`,
        description: template.description,
        content: template.content,
        isSystem: false,
        providerId,
      });
      await loadTemplates();
      setEditingTemplate(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate template");
    }
  }

  function handleExport(template: Template) {
    const data = JSON.stringify(
      { name: template.name, description: template.description, content: template.content },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "system", label: "KasaMD" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-gtsuper">Templates</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-button px-4 py-2 text-sm font-medium text-white hover:bg-button-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative pb-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-900 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Favourites section */}
      {!loading && favouriteTemplates.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Favourites</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {favouriteTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setEditingTemplate(template)}
                className="flex aspect-square flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <span className="line-clamp-3 text-xs font-medium text-gray-700">{template.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search input */}
      {!loading && templates.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a template..."
            className="w-full max-w-sm rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Template table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No templates yet. Click "Create Template" to create one.
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No templates match your search.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-white">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th className="py-3 pl-4 pr-4 font-medium">Template name</th>
                <th className="py-3 pr-4 font-medium">Last edited</th>
                <th className="py-3 pr-4 font-medium">Created By</th>
                <th className="py-3 pr-4 font-medium w-36">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  onClick={() => setEditingTemplate(template)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="py-3 pl-4 pr-4">
                    <span className="text-sm font-normal text-gray-900">
                      {template.name}
                    </span>
                    {template.description && (
                      <span className="ml-2 text-xs text-gray-400">
                        {template.description}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-500">
                    {formatDate(template.updatedAt)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        template.isSystem
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {template.isSystem ? "KasaMD" : "Custom"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title={template.isSystem ? "View" : "Edit"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await db.toggleTemplateFavourite(template.id, !template.isFavourite);
                          await loadTemplates();
                        }}
                        className={`rounded p-1 hover:bg-gray-100 ${
                          template.isFavourite ? "text-yellow-500" : "text-gray-400 hover:text-gray-600"
                        }`}
                        title={template.isFavourite ? "Unfavourite" : "Favourite"}
                      >
                        <Star className="h-4 w-4" fill={template.isFavourite ? "#eab308" : "none"} stroke={template.isFavourite ? "#eab308" : "currentColor"} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(template);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Export"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <div className="relative" data-menu-container>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(
                              menuOpenId === template.id ? null : template.id,
                            );
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="More"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpenId === template.id && (
                          <div className="absolute right-0 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-10">
                            {!template.isSystem && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  setEditingTemplate(template);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(null);
                                handleDuplicate(template);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </button>
                            {!template.isSystem && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  setDeletingTemplate(template);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/view template modal */}
      {editingTemplate && (
        <TemplateModal
          template={editingTemplate}
          readOnly={editingTemplate.isSystem}
          onSave={handleEditSave}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {/* Create template modal */}
      {showCreate && (
        <TemplateModal
          onSave={handleCreateSave}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        message={`Are you sure you want to delete "${deletingTemplate?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
