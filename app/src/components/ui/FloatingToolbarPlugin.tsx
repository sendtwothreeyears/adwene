/**
 * FloatingToolbarPlugin — a Lexical plugin that renders a floating formatting
 * toolbar above the current text selection. Supports bold, italic, underline,
 * alignment, and list formatting.
 *
 * Must be rendered inside a <LexicalComposer>.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  type RangeSelection,
  type ElementFormatType,
} from "lexical";
import { $isListNode, ListNode } from "@lexical/list";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import type { LexicalNode } from "lexical";

/** Walk up the tree to find the nearest ancestor of a given type. */
function $findNearestListNode(node: LexicalNode): ListNode | null {
  let current: LexicalNode | null = node;
  while (current !== null) {
    if ($isListNode(current)) return current;
    current = current.getParent();
  }
  return null;
}
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSelectionRect(): DOMRect | null {
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) return null;
  const range = domSelection.getRangeAt(0);
  return range.getBoundingClientRect();
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        // Prevent stealing focus / collapsing the selection
        e.preventDefault();
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active
          ? "bg-primary-light/15 text-primary-light"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-0.5 h-4 w-px bg-gray-200" />;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Active format states
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [alignment, setAlignment] = useState<ElementFormatType>("");
  const [listType, setListType] = useState<"bullet" | "number" | null>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setIsVisible(false);
      return;
    }

    // Check if editor is editable
    if (!editor.isEditable()) {
      setIsVisible(false);
      return;
    }

    const rangeSelection = selection as RangeSelection;

    // Format states
    setIsBold(rangeSelection.hasFormat("bold"));
    setIsItalic(rangeSelection.hasFormat("italic"));
    setIsUnderline(rangeSelection.hasFormat("underline"));

    // Alignment — read from the anchor node's parent element
    const anchorNode = rangeSelection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root"
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow();
    if ("getFormatType" in element) {
      setAlignment(
        (element as unknown as { getFormatType: () => ElementFormatType }).getFormatType(),
      );
    } else {
      setAlignment("");
    }

    // List state
    const parentList = $findNearestListNode(anchorNode);
    if (parentList) {
      const tag = parentList.getListType();
      setListType(tag === "bullet" ? "bullet" : tag === "number" ? "number" : null);
    } else {
      setListType(null);
    }

    // Position the toolbar above the selection
    const rect = getSelectionRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setIsVisible(false);
      return;
    }

    const toolbarWidth = 290; // approximate width
    const toolbarHeight = 36;
    const gap = 8;

    let top = rect.top - toolbarHeight - gap + window.scrollY;
    let left = rect.left + rect.width / 2 - toolbarWidth / 2 + window.scrollX;

    // Clamp to viewport
    if (left < 4) left = 4;
    if (left + toolbarWidth > window.innerWidth - 4) {
      left = window.innerWidth - toolbarWidth - 4;
    }
    if (top < 4) {
      // Show below instead
      top = rect.bottom + gap + window.scrollY;
    }

    setPosition({ top, left });
    setIsVisible(true);
  }, [editor]);

  // Listen to selection changes
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, updateToolbar]);

  // Also listen to general updates (formatting changes, etc.)
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  // Hide on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsVisible(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Hide on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        // Don't immediately hide — let the selection change handler decide
        // (clicking in the editor may create a new selection)
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  if (!isVisible) return null;

  const toolbar = (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
      }}
      className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1 py-1 shadow-lg animate-in fade-in zoom-in-95"
    >
      {/* Text formatting */}
      <ToolbarButton
        active={isBold}
        title="Bold"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <Bold size={15} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        active={isItalic}
        title="Italic"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <Italic size={15} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        active={isUnderline}
        title="Underline"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")
        }
      >
        <Underline size={15} strokeWidth={2.5} />
      </ToolbarButton>

      <Separator />

      {/* Alignment */}
      <ToolbarButton
        active={alignment === "" || alignment === "left"}
        title="Align left"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")
        }
      >
        <AlignLeft size={15} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        active={alignment === "center"}
        title="Align center"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")
        }
      >
        <AlignCenter size={15} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        active={alignment === "right"}
        title="Align right"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")
        }
      >
        <AlignRight size={15} strokeWidth={2} />
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton
        active={listType === "bullet"}
        title="Bullet list"
        onClick={() => {
          if (listType === "bullet") {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          }
        }}
      >
        <List size={15} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        active={listType === "number"}
        title="Numbered list"
        onClick={() => {
          if (listType === "number") {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          }
        }}
      >
        <ListOrdered size={15} strokeWidth={2} />
      </ToolbarButton>
    </div>
  );

  return createPortal(toolbar, document.body);
}
