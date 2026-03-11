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
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import type { EditorState, SerializedEditorState } from "lexical";

const EDITOR_NODES = [ListNode, ListItemNode, LinkNode, CodeNode];

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
}

export default function TemplateEditor({
  initialState,
  onChange,
  readOnly = false,
}: TemplateEditorProps) {
  const initialConfig = {
    namespace: "TemplateEditor",
    nodes: EDITOR_NODES,
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
        className={`rounded-md border ${
          readOnly
            ? "border-gray-200 bg-gray-50"
            : "border-gray-300 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
        }`}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[200px] px-4 py-3 text-sm text-gray-900 outline-none" />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        {onChange && <OnChangePlugin onChange={handleChange} />}
        <LoadStatePlugin editorState={initialState} />
      </div>
    </LexicalComposer>
  );
}
