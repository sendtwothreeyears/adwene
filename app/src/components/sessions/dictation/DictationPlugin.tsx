/**
 * DictationPlugin — a Lexical plugin that manages the dictation lifecycle
 * within the editor: captures cursor position, inserts/removes the
 * DictationNode, locks the editor during dictation, and inserts transcribed
 * text when done.
 *
 * Must be rendered inside a <LexicalComposer>.
 */

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  $getNodeByKey,
} from "lexical";
import type { NodeKey } from "lexical";
import {
  $createDictationNode,
  $isDictationNode,
} from "./DictationNode";

export interface DictationPluginProps {
  /** True while the user is actively recording audio. */
  isDictating: boolean;
  /** True while sidecar is processing audio (after recording stops). */
  isProcessing: boolean;
  /** The transcribed text result (null until transcription completes). */
  transcribedText: string | null;
  /** Called when dictation is fully complete (text inserted or empty result). */
  onDictationComplete: () => void;
  /** Called when the plugin needs to lock/unlock the editor. */
  onLockChange: (locked: boolean) => void;
}

export default function DictationPlugin({
  isDictating,
  isProcessing,
  transcribedText,
  onDictationComplete,
  onLockChange,
}: DictationPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Track the DictationNode key to find it later
  const nodeKeyRef = useRef<NodeKey | null>(null);
  // Track previous state to detect transitions
  const prevDictatingRef = useRef(false);
  const prevProcessingRef = useRef(false);

  // Handle isDictating transition: false → true (start dictation)
  useEffect(() => {
    if (isDictating && !prevDictatingRef.current) {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        // Collapse selection to anchor point
        const anchor = selection.anchor;
        selection.focus.set(anchor.key, anchor.offset, anchor.type);

        // Insert the DictationNode at cursor
        const dictationNode = $createDictationNode("recording");
        selection.insertNodes([dictationNode]);
        nodeKeyRef.current = dictationNode.getKey();
      });

      // Lock the editor
      onLockChange(true);
    }
    prevDictatingRef.current = isDictating;
  }, [isDictating, editor, onLockChange]);

  // Handle isProcessing transition: false → true (swap mic → spinner)
  useEffect(() => {
    if (isProcessing && !prevProcessingRef.current) {
      editor.update(() => {
        // Find and remove the recording node, insert a processing one
        const oldKey = nodeKeyRef.current;
        if (oldKey) {
          const oldNode = $getNodeByKey(oldKey);
          if (oldNode && $isDictationNode(oldNode)) {
            const processingNode = $createDictationNode("processing");
            oldNode.replace(processingNode);
            nodeKeyRef.current = processingNode.getKey();
          }
        }
      });
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing, editor]);

  // Handle transcribedText becoming non-null (insert text)
  useEffect(() => {
    if (transcribedText === null) return;

    editor.update(() => {
      const nodeKey = nodeKeyRef.current;
      if (nodeKey) {
        const node = $getNodeByKey(nodeKey);
        if (node && $isDictationNode(node)) {
          if (transcribedText.length > 0) {
            // Insert text where the dictation node is
            const textNode = $createTextNode(transcribedText);
            node.replace(textNode);
            // Place cursor after inserted text
            textNode.selectEnd();
          } else {
            // Empty result — just remove the node
            node.remove();
          }
        }
      }
      nodeKeyRef.current = null;
    });

    // Unlock the editor
    onLockChange(false);
    onDictationComplete();
  }, [transcribedText, editor, onLockChange, onDictationComplete]);

  // Cleanup: if component unmounts while dictating, remove the node and unlock
  useEffect(() => {
    return () => {
      const nodeKey = nodeKeyRef.current;
      if (nodeKey) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node && $isDictationNode(node)) {
            node.remove();
          }
        });
        nodeKeyRef.current = null;
        onLockChange(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
