/**
 * Converts a markdown string into a Lexical SerializedEditorState
 * using a headless editor with the same node set as SessionEditor.
 */

import { createHeadlessEditor } from "@lexical/headless";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { SerializedEditorState } from "lexical";

const EDITOR_NODES = [ListNode, ListItemNode, LinkNode, CodeNode, HeadingNode, QuoteNode];

export function markdownToLexical(markdown: string): SerializedEditorState {
  const editor = createHeadlessEditor({
    namespace: "MarkdownConverter",
    nodes: EDITOR_NODES,
    onError: (error: Error) => {
      console.error("Markdown conversion error:", error);
    },
  });

  editor.update(
    () => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    },
    { discrete: true },
  );

  return editor.getEditorState().toJSON();
}
