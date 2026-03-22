/**
 * Lexical-based rich text editor for viewing and editing templates.
 * Renders Lexical editor state and supports bold formatting.
 */

import { useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { EditorState, SerializedEditorState } from "lexical";
import FloatingToolbarPlugin from "../ui/FloatingToolbarPlugin";

const EDITOR_NODES = [ListNode, ListItemNode, LinkNode, CodeNode, HeadingNode, QuoteNode];

const EDITOR_THEME = {
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
  },
  list: {
    ul: "list-disc ml-4",
    ol: "list-decimal ml-4",
    listitem: "my-0.5",
    nested: {
      listitem: "list-none",
    },
  },
  paragraph: "my-1",
  heading: {
    h1: "text-base font-semibold my-2",
    h2: "text-base font-semibold my-2",
    h3: "text-base font-semibold my-1",
  },
  quote: "border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2",
  formatLeft: "text-left",
  formatCenter: "text-center",
  formatRight: "text-right",
  formatJustify: "text-justify",
};

/** Loads an existing Lexical editor state into the editor. */
function LoadStatePlugin({
  editorState,
}: {
  editorState: SerializedEditorState | null;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editorState) return;
    const state = editor.parseEditorState(editorState);
    editor.setEditorState(state);
  }, [editor, editorState]);

  return null;
}

interface TemplateEditorProps {
  /** Existing Lexical editor state to load (null for empty editor). */
  initialState: SerializedEditorState | null;
  /** Called on every change with the serialized editor state. */
  onChange?: (state: SerializedEditorState) => void;
  /** If true, the editor is read-only. */
  readOnly?: boolean;
  /** Placeholder text shown when editor is empty. */
  placeholder?: string;
  /** Additional CSS classes for the outer wrapper. */
  className?: string;
}

export default function TemplateEditor({
  initialState,
  onChange,
  readOnly = false,
  placeholder = "Start writing your template...",
  className,
}: TemplateEditorProps) {
  const initialConfig = {
    namespace: "TemplateEditor",
    nodes: EDITOR_NODES,
    theme: EDITOR_THEME,
    editable: !readOnly,
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
  };

  function handleChange(editorState: EditorState) {
    if (onChange) {
      onChange(editorState.toJSON());
    }
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={`relative ${readOnly ? "rounded-md border border-gray-200 bg-gray-50" : ""} ${className ?? ""}`}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[200px] px-4 text-base text-gray-900 outline-none font-fakt"
              placeholder={<div className="pointer-events-none absolute top-0 left-0 text-sm text-gray-400">{placeholder}</div>}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        {!readOnly && <FloatingToolbarPlugin />}
        {onChange && <OnChangePlugin onChange={handleChange} />}
        <LoadStatePlugin editorState={initialState} />
      </div>
    </LexicalComposer>
  );
}
