import { useState, useRef, useEffect } from "react";
import type { Template } from "../../types";
import TemplateSelectorModal from "../templates/TemplateSelectorModal";

interface NoteToolbarProps {
  hasNote: boolean;
  isGenerating: boolean;
  isExporting: boolean;
  onCopy: () => void;
  onExportPDF: () => void;
  onRegenerate: () => void;
  canGenerate: boolean;
  templates: Template[];
  selectedTemplateId: string | null;
  onTemplateChange: (id: string) => void;
}

export default function NoteToolbar({
  hasNote,
  isGenerating,
  isExporting,
  onCopy,
  onExportPDF,
  onRegenerate,
  canGenerate,
  templates,
  selectedTemplateId,
  onTemplateChange,
}: NoteToolbarProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const handleCopy = () => {
    onCopy();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const selected = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowTemplateModal(true)}
          className="inline-flex min-w-[200px] items-center justify-between rounded-lg border border-border bg-white px-4 py-1.5 text-left transition-colors hover:border-gray-400"
        >
          <span className="mr-1 truncate text-sm text-gray-900">
            {selected?.name ?? "Select template"}
          </span>
          <svg
            className="h-5 w-5 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <TemplateSelectorModal
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={(id) => { if (id) onTemplateChange(id); }}
        />
        <OptionsMenu
          hasNote={hasNote}
          isGenerating={isGenerating}
          isExporting={isExporting}
          onCopy={onCopy}
          onExportPDF={onExportPDF}
          onRegenerate={onRegenerate}
          canGenerate={canGenerate}
        />
        {(isGenerating || isExporting) && (
          <div className="ml-1 h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!hasNote || isCopied}
          className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** "..." options menu — mirrors client's DropdownButton. */
function OptionsMenu({
  hasNote,
  isGenerating,
  isExporting,
  onCopy,
  onExportPDF,
  onRegenerate,
  canGenerate,
}: {
  hasNote: boolean;
  isGenerating: boolean;
  isExporting: boolean;
  onCopy: () => void;
  onExportPDF: () => void;
  onRegenerate: () => void;
  canGenerate: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [isOpen]);

  const act = (fn: () => void, disabled = false) => {
    if (disabled) return;
    fn();
    setIsOpen(false);
  };

  return (
    <div className="self-stretch flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-1 items-center justify-center rounded-lg border border-border px-2 py-1.5 font-semibold transition-colors hover:bg-gray-50"
      >
        <img src="/icons/ellipsis.svg" alt="More options" className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: position.top, left: position.left }}
          className="z-50 w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => act(onCopy, !hasNote)}
            disabled={!hasNote}
            className={`w-full px-4 py-2 text-left text-sm transition-colors ${
              hasNote ? "text-gray-900 hover:bg-gray-50" : "cursor-not-allowed text-gray-400"
            }`}
          >
            Copy Note
          </button>

          <button
            type="button"
            onClick={() => act(onExportPDF, !hasNote || isExporting)}
            disabled={!hasNote || isExporting}
            className={`w-full px-4 py-2 text-left text-sm transition-colors ${
              hasNote && !isExporting ? "text-gray-900 hover:bg-gray-50" : "cursor-not-allowed text-gray-400"
            }`}
          >
            {isExporting ? "Exporting..." : "Export as PDF"}
          </button>

          <div className="my-1 border-t border-gray-200" />

          <button
            type="button"
            onClick={() => act(onRegenerate, !canGenerate || isGenerating)}
            disabled={!canGenerate || isGenerating}
            className={`w-full px-4 py-2 text-left text-sm transition-colors ${
              canGenerate && !isGenerating
                ? "text-gray-900 hover:bg-gray-50"
                : "cursor-not-allowed text-gray-400"
            }`}
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
