/**
 * Converts a markdown string into a Lexical SerializedEditorState
 * using a headless editor with the same node set as SessionEditor.
 *
 * Handles standard markdown (headings, lists, bold, etc.) via Lexical's
 * built-in markdown transformer, then post-processes text nodes to replace
 * {{drug:...}} and {{condition:...}} markers with ClinicalEntityNodes.
 */

import { createHeadlessEditor } from "@lexical/headless";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, $createTextNode, TextNode } from "lexical";
import type { SerializedEditorState } from "lexical";
import {
  ClinicalEntityNode,
  $createClinicalEntityNode,
} from "./clinicalEntityNode";
import type { ClinicalEntityType } from "./clinicalEntityNode";

const EDITOR_NODES = [
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  HeadingNode,
  QuoteNode,
  ClinicalEntityNode,
];

const ENTITY_REGEX = /\{\{(drug|condition):(.+?)\}\}/g;

/**
 * Walk all TextNodes in the tree and replace {{drug:...}} / {{condition:...}}
 * patterns with ClinicalEntityNode instances.
 */
function $replaceEntityMarkers(): void {
  const root = $getRoot();
  const textNodes = root.getAllTextNodes();

  for (const textNode of textNodes) {
    const text = textNode.getTextContent();
    if (!text.includes("{{")) continue;

    ENTITY_REGEX.lastIndex = 0;
    const matches = [...text.matchAll(ENTITY_REGEX)];
    if (matches.length === 0) continue;

    // Preserve the original text format (bold, italic, etc.)
    const format = textNode.getFormat();
    let lastIndex = 0;
    const nodes: (TextNode | ClinicalEntityNode)[] = [];

    for (const match of matches) {
      const matchStart = match.index!;
      const entityType = match[1] as ClinicalEntityType;
      const term = match[2];

      // Text before this match
      if (matchStart > lastIndex) {
        const before = $createTextNode(text.slice(lastIndex, matchStart));
        if (format) before.setFormat(format);
        nodes.push(before);
      }

      // The entity node
      nodes.push($createClinicalEntityNode(entityType, term));

      lastIndex = matchStart + match[0].length;
    }

    // Text after last match
    if (lastIndex < text.length) {
      const after = $createTextNode(text.slice(lastIndex));
      if (format) after.setFormat(format);
      nodes.push(after);
    }

    // Replace the original text node with the split nodes
    for (const node of nodes) {
      textNode.insertBefore(node);
    }
    textNode.remove();
  }
}

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
      $replaceEntityMarkers();
    },
    { discrete: true },
  );

  return editor.getEditorState().toJSON();
}
