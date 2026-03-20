/**
 * Convert a serialized Lexical editor state to HTML.
 *
 * Lightweight alternative to @lexical/html's $generateHtmlFromNodes —
 * walks the JSON tree directly without needing a live editor instance.
 * Handles the node types used in medical notes: paragraphs, headings,
 * text (bold/italic/underline), lists, clinical entities, and linebreaks.
 */

import type { SerializedEditorState } from "lexical";

// Lexical text format bitmask flags
const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_UNDERLINE = 8;

interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  format?: number | string;
  tag?: string;
  listType?: string;
  // ClinicalEntityNode fields
  entityType?: string;
  term?: string;
  // Link fields
  url?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTextNode(node: LexicalNode): string {
  const text = escapeHtml(node.text ?? "");
  if (!text) return "";

  const format = typeof node.format === "number" ? node.format : 0;
  let html = text;

  if (format & IS_BOLD) html = `<strong>${html}</strong>`;
  if (format & IS_ITALIC) html = `<em>${html}</em>`;
  if (format & IS_UNDERLINE) html = `<u>${html}</u>`;

  return html;
}

function renderNode(node: LexicalNode): string {
  switch (node.type) {
    case "root":
      return renderChildren(node);

    case "paragraph":
      return `<p>${renderChildren(node)}</p>`;

    case "heading": {
      const tag = node.tag ?? "h1";
      return `<${tag}>${renderChildren(node)}</${tag}>`;
    }

    case "text":
      return renderTextNode(node);

    case "linebreak":
      return "<br/>";

    case "list": {
      const tag = node.listType === "number" ? "ol" : "ul";
      return `<${tag}>${renderChildren(node)}</${tag}>`;
    }

    case "listitem":
      return `<li>${renderChildren(node)}</li>`;

    case "clinical-entity":
      return `<span>${escapeHtml(node.term ?? "")}</span>`;

    case "link":
      return renderChildren(node);

    case "quote":
      return `<blockquote>${renderChildren(node)}</blockquote>`;

    case "code":
      return `<pre><code>${renderChildren(node)}</code></pre>`;

    default:
      // Unknown node — render children if any, otherwise skip
      return node.children ? renderChildren(node) : "";
  }
}

function renderChildren(node: LexicalNode): string {
  if (!node.children) return "";
  return node.children.map(renderNode).join("");
}

/**
 * Convert a serialized Lexical editor state to an HTML string.
 * Returns the inner HTML (no wrapper <html>/<body> tags).
 */
export function lexicalToHtml(state: SerializedEditorState): string {
  const root = state.root as unknown as LexicalNode;
  return renderNode(root);
}
