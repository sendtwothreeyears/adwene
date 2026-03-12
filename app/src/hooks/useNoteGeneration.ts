import { useState, useRef, useCallback, useEffect } from "react";
import { useSidecar } from "../contexts/SidecarContext";

interface UseNoteGenerationReturn {
  isGenerating: boolean;
  isStreaming: boolean;
  streamingText: string;
  error: string | null;
  generateNote: (sessionId: string, transcript: string, template?: string) => void;
  onNoteGenerated: (callback: (content: unknown) => void) => void;
}

export function useNoteGeneration(): UseNoteGenerationReturn {
  const { send, onMessage, connectionState } = useSidecar();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const callbackRef = useRef<((content: unknown) => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);
  const accumulatedRef = useRef("");

  // Subscribe to sidecar messages
  useEffect(() => {
    const unsub = onMessage((raw: string) => {
      let data: {
        type: string;
        session_id?: string;
        content?: unknown;
        text?: string;
        message?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      // Only handle messages for our active session
      if (data.session_id && data.session_id !== sessionIdRef.current) return;

      if (data.type === "note_progress") {
        isGeneratingRef.current = true;
        setIsGenerating(true);
        setIsStreaming(true);
        accumulatedRef.current = "";
        setStreamingText("");
      } else if (data.type === "note_chunk") {
        accumulatedRef.current += data.text ?? "";
        setStreamingText(accumulatedRef.current);
      } else if (data.type === "note") {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        setIsStreaming(false);
        setStreamingText("");
        setError(null);
        callbackRef.current?.(data.content);
      } else if (data.type === "error" && isGeneratingRef.current) {
        // Only capture errors while actively generating — prevents
        // cross-hook leakage from transcription or other operations
        isGeneratingRef.current = false;
        setError(data.message ?? "Note generation error");
        setIsGenerating(false);
        setIsStreaming(false);
      }
    });

    return unsub;
  }, [onMessage]);

  // Handle connection loss while generating
  useEffect(() => {
    if (connectionState === "disconnected" && isGenerating) {
      isGeneratingRef.current = false;
      setError("Connection lost during note generation");
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, [connectionState, isGenerating]);

  const generateNote = useCallback(
    (sessionId: string, transcript: string, template?: string) => {
      sessionIdRef.current = sessionId;
      setError(null);
      isGeneratingRef.current = true;
      setIsGenerating(true);
      accumulatedRef.current = "";
      setStreamingText("");
      send(
        JSON.stringify({
          type: "generate_note",
          session_id: sessionId,
          transcript,
          template: template ?? "",
        }),
      );
    },
    [send],
  );

  const onNoteGenerated = useCallback((callback: (content: unknown) => void) => {
    callbackRef.current = callback;
  }, []);

  return {
    isGenerating,
    isStreaming,
    streamingText,
    error,
    generateNote,
    onNoteGenerated,
  };
}
