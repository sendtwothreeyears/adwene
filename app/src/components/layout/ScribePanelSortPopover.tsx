import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type SortField = "createdAt" | "updatedAt" | "name" | "status";
export type SortDirection = "asc" | "desc";

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "createdAt", label: "Date created" },
  { value: "updatedAt", label: "Date updated" },
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
];

interface Props {
  anchorEl: HTMLElement | null;
  field: SortField;
  direction: SortDirection;
  onFieldChange: (field: SortField) => void;
  onDirectionChange: (direction: SortDirection) => void;
  onClose: () => void;
}

export default function ScribePanelSortPopover({
  anchorEl,
  field,
  direction,
  onFieldChange,
  onDirectionChange,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorEl]);

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={{ top: rect.bottom + 4, left: rect.left }}
    >
      {SORT_FIELDS.map((f) => (
        <button
          key={f.value}
          onClick={() => { onFieldChange(f.value); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
              field === f.value
                ? "border-gray-900"
                : "border-gray-300"
            }`}
          >
            {field === f.value && (
              <span className="h-2 w-2 rounded-full bg-gray-900" />
            )}
          </span>
          {f.label}
        </button>
      ))}

      <div className="my-1 border-t border-gray-100" />

      {(["asc", "desc"] as const).map((dir) => (
        <button
          key={dir}
          onClick={() => { onDirectionChange(dir); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="w-4 text-center text-xs">
            {direction === dir ? "\u2713" : ""}
          </span>
          {dir === "asc" ? "Ascending" : "Descending"}
        </button>
      ))}
    </div>,
    document.body
  );
}
