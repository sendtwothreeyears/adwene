/**
 * ClinicalEntityNode — a Lexical DecoratorNode that represents a drug or condition
 * mentioned in a clinical note. Rendered as a styled <span> in the editor.
 *
 * Ported from server/utils/editor/clinicalEntityNode.ts with React rendering added.
 */

import { DecoratorNode } from "lexical";
import type {
  DOMConversionMap,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";
import { createElement } from "react";
import type { JSX } from "react";

export type ClinicalEntityType = "drug" | "condition";

export interface SerializedClinicalEntityNode extends SerializedLexicalNode {
  entityType: ClinicalEntityType;
  term: string;
}

export class ClinicalEntityNode extends DecoratorNode<JSX.Element> {
  __entityType: ClinicalEntityType;
  __term: string;

  static getType(): string {
    return "clinical-entity";
  }

  static clone(node: ClinicalEntityNode): ClinicalEntityNode {
    return new ClinicalEntityNode(node.__entityType, node.__term, node.__key);
  }

  constructor(entityType: ClinicalEntityType, term: string, key?: NodeKey) {
    super(key);
    this.__entityType = entityType;
    this.__term = term;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = `clinical-entity clinical-entity-${this.__entityType}`;
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.className = `clinical-entity clinical-entity-${this.__entityType}`;
    element.textContent = this.__term;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  static importJSON(
    serializedNode: SerializedClinicalEntityNode,
  ): ClinicalEntityNode {
    return new ClinicalEntityNode(
      serializedNode.entityType,
      serializedNode.term,
    );
  }

  exportJSON(): SerializedClinicalEntityNode {
    return {
      type: "clinical-entity",
      version: 1,
      entityType: this.__entityType,
      term: this.__term,
    };
  }

  getTextContent(): string {
    return this.__term;
  }

  isInline(): true {
    return true;
  }

  decorate(): JSX.Element {
    return createElement(
      "span",
      { className: `clinical-entity clinical-entity-${this.__entityType}` },
      this.__term,
    );
  }
}

export function $createClinicalEntityNode(
  entityType: ClinicalEntityType,
  term: string,
): ClinicalEntityNode {
  return new ClinicalEntityNode(entityType, term);
}

export function $isClinicalEntityNode(
  node: LexicalNode | null | undefined,
): node is ClinicalEntityNode {
  return node instanceof ClinicalEntityNode;
}
