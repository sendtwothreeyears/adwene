/**
 * Lexical-based rich text editor for session tabs (Context, Transcription, Note).
 * Reusable across all three tabs — mount with different initialState per tab.
 */

import { memo, useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { EditorState, SerializedEditorState } from "lexical";

const EDITOR_NODES = [ListNode, ListItemNode, LinkNode, CodeNode, HeadingNode, QuoteNode];

/** Loads an existing Lexical editor state into the editor on mount. */
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

interface SessionEditorProps {
  /** Existing Lexical editor state to load (null for empty editor). */
  initialState: SerializedEditorState | null;
  /** Called on every change with the serialized editor state. */
  onChange?: (state: SerializedEditorState) => void;
  /** If true, the editor is read-only. */
  readOnly?: boolean;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
}

export default memo(function SessionEditor({
  initialState,
  onChange,
  readOnly = false,
  placeholder,
}: SessionEditorProps) {
  const initialConfig = {
    namespace: "SessionEditor",
    nodes: EDITOR_NODES,
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

  const editorClassName = "min-h-0 flex-1 overflow-auto px-4 py-3 text-sm text-gray-900 outline-none";
  const placeholderEl = (
    <div className="pointer-events-none absolute top-0 left-0 px-4 py-3 text-sm text-gray-400">
      {placeholder}
    </div>
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={`relative flex h-full flex-col rounded-md border border-border bg-white ${
          readOnly
            ? ""
            : "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
        }`}
      >
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
        <HistoryPlugin />
        {onChange && <OnChangePlugin onChange={handleChange} />}
        <LoadStatePlugin editorState={initialState} />
      </div>
    </LexicalComposer>
  );
});
