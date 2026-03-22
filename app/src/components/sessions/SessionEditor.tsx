/**
 * Lexical-based rich text editor for session tabs (Context, Transcription, Note).
 * Reusable across all three tabs — mount with different initialState per tab.
 */

import { memo, useEffect, useRef } from "react";
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
import { ClinicalEntityNode } from "../../lib/clinicalEntityNode";
import FloatingToolbarPlugin from "../ui/FloatingToolbarPlugin";

const EDITOR_NODES = [ListNode, ListItemNode, LinkNode, CodeNode, HeadingNode, QuoteNode, ClinicalEntityNode];

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
    h1: "text-base font-semibold my-2 font-sans",
    h2: "text-base font-semibold my-2 font-sans",
    h3: "text-base font-semibold my-1 font-sans",
  },
  quote: "border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2",
  // Alignment classes used by FORMAT_ELEMENT_COMMAND
  formatLeft: "text-left",
  formatCenter: "text-center",
  formatRight: "text-right",
  formatJustify: "text-justify",
};

/** Loads an existing Lexical editor state into the editor on mount.
 *  Only runs once — subsequent prop changes are ignored because the editor
 *  is the source of truth while mounted. Remounting (via key-prop change)
 *  handles cases where a fresh state must be loaded (e.g. streaming finish). */
function LoadStatePlugin({
  editorState,
}: {
  editorState: SerializedEditorState | null;
}) {
  const [editor] = useLexicalComposerContext();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !editorState) return;
    loadedRef.current = true;
    const state = editor.parseEditorState(editorState);
    editor.setEditorState(state);
  }, [editor, editorState]);

  return null;
}

/** Updates the editor state on every prop change during streaming.
 *  The editor is read-only during streaming, so undo history is not a concern. */
function StreamingStatePlugin({
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

interface SessionEditorProps {
  /** Existing Lexical editor state to load (null for empty editor). */
  initialState: SerializedEditorState | null;
  /** Called on every change with the serialized editor state. */
  onChange?: (state: SerializedEditorState) => void;
  /** If true, the editor is read-only. */
  readOnly?: boolean;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Optional header rendered inside the editor card, above the content area. */
  header?: React.ReactNode;
  /** When true, update editor state on every prop change (for streaming preview). */
  streaming?: boolean;
}

export default memo(function SessionEditor({
  initialState,
  onChange,
  readOnly = false,
  placeholder,
  header,
  streaming = false,
}: SessionEditorProps) {
  const initialConfig = {
    namespace: "SessionEditor",
    nodes: EDITOR_NODES,
    theme: EDITOR_THEME,
    editable: !readOnly,
    onError: (error: Error) => {
      console.error("SessionEditor error:", error);
    },
  };

  function handleChange(editorState: EditorState) {
    if (onChange) {
      onChange(editorState.toJSON());
    }
  }

  const editorClassName = "min-h-0 flex-1 overflow-auto scrollbar-hide px-4 py-3 text-base text-gray-900 outline-none font-fakt max-w-[800px]";
  const placeholderEl = (
    <div className="pointer-events-none absolute top-0 left-0 px-4 py-3 text-base text-gray-400">
      {placeholder}
    </div>
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className="relative flex h-full flex-col rounded-md border border-border bg-white"
      >
        {header}
        <div className="relative min-h-0 flex-1 flex flex-col">
          <RichTextPlugin
            contentEditable={
              placeholder ? (
                <ContentEditable
                  className={editorClassName}
                  aria-placeholder={placeholder}
                  placeholder={placeholderEl}
                />
              ) : (
                <ContentEditable className={editorClassName} />
              )
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        {!readOnly && <FloatingToolbarPlugin />}
        {onChange && <OnChangePlugin onChange={handleChange} />}
        {streaming ? (
          <StreamingStatePlugin editorState={initialState} />
        ) : (
          <LoadStatePlugin editorState={initialState} />
        )}
      </div>
    </LexicalComposer>
  );
});
