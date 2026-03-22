/**
 * DictationNode — a Lexical DecoratorNode rendered inline at the cursor
 * position during dictation.  Shows a pulsing mic icon while recording
 * and a spinner while the sidecar is processing audio.
 */

import { DecoratorNode } from "lexical";
import type {
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";
import { createElement } from "react";
import type { JSX } from "react";
import { Mic, Loader2 } from "lucide-react";

export type DictationNodeState = "recording" | "processing";

export interface SerializedDictationNode extends SerializedLexicalNode {
  dictationState: DictationNodeState;
}

function DictationIndicator({ state }: { state: DictationNodeState }) {
  if (state === "recording") {
    return createElement(Mic, {
      size: 18,
      className: "inline-block animate-pulse text-red-500 align-middle mx-0.5",
    });
  }
  return createElement(Loader2, {
    size: 18,
    className: "inline-block animate-spin text-gray-500 align-middle mx-0.5",
  });
}

export class DictationNode extends DecoratorNode<JSX.Element> {
  __dictationState: DictationNodeState;

  static getType(): string {
    return "dictation-indicator";
  }

  static clone(node: DictationNode): DictationNode {
    return new DictationNode(node.__dictationState, node.__key);
  }

  constructor(dictationState: DictationNodeState, key?: NodeKey) {
    super(key);
    this.__dictationState = dictationState;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "dictation-indicator";
    // Prevent the node from being selectable/editable
    span.contentEditable = "false";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedDictationNode): DictationNode {
    return new DictationNode(serializedNode.dictationState);
  }

  exportJSON(): SerializedDictationNode {
    return {
      type: "dictation-indicator",
      version: 1,
      dictationState: this.__dictationState,
    };
  }

  getTextContent(): string {
    return "";
  }

  isInline(): true {
    return true;
  }

  canInsertTextBefore(): false {
    return false;
  }

  canInsertTextAfter(): false {
    return false;
  }

  decorate(): JSX.Element {
    return createElement(DictationIndicator, {
      state: this.__dictationState,
    });
  }
}

export function $createDictationNode(
  state: DictationNodeState,
): DictationNode {
  return new DictationNode(state);
}

export function $isDictationNode(
  node: LexicalNode | null | undefined,
): node is DictationNode {
  return node instanceof DictationNode;
}
