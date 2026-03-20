import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSidecar } from "../contexts/SidecarContext";

interface UseTranscriptionReturn {
  segments: string[];
  liveTranscript: string;
  finalTranscript: string | null;
  isTranscribing: boolean;
  isRefining: boolean;
  refinedTranscript: string | null;
  refinementSelected: string | null;  // "full_audio" | "segments" | null
  error: string | null;
  startTranscription: (sessionId: string) => void;
  stopTranscription: () => Promise<string>;
  sendAudioChunk: (chunk: Int16Array) => void;
  reset: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const { send, sendBinary, onMessage, connectionState } = useSidecar();

  const [segments, setSegments] = useState<string[]>([]);
  const [partialText, setPartialText] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinedTranscript, setRefinedTranscript] = useState<string | null>(null);
  const [refinementSelected, setRefinementSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const resolveRef = useRef<((text: string) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: join completed segments + current partial for display.
  // Strip trailing sentence-end punctuation from each segment so the live
  // view reads as a continuous flow. The final batch transcript (which
  // processes all audio at once) provides the authoritative punctuation.
  const liveTranscript = useMemo(() => {
    const cleaned = segments.map((s) => s.replace(/[.!?]+$/g, "").trim());
    const completed = cleaned.filter(Boolean).join(" ");
    if (partialText) {
      return completed ? `${completed} ${partialText}` : partialText;
    }
    return completed;
  }, [segments, partialText]);

  // Subscribe to sidecar messages
  useEffect(() => {
    const unsub = onMessage((raw: string) => {
      let data: {
        type: string;
        session_id?: string;
        text?: string;
        is_final?: boolean;
        segment_index?: number;
        message?: string;
        selected?: string;
        reason?: string;
        edit_ratio?: number;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      // Only handle messages for our active session
      if (data.session_id && data.session_id !== sessionIdRef.current) return;

      if (data.type === "transcript_partial" && data.text != null) {
        // Interim result while speech is ongoing — replaces previous partial
        setPartialText(data.text);
      } else if (data.type === "transcript_segment" && data.text != null) {
        // Completed utterance — append to segments, clear partial
        setPartialText(null);
        setSegments((prev) => [...prev, data.text!]);
      } else if (data.type === "transcript_final" && data.text != null) {
        // Final reconciled transcript replaces live segments
        setPartialText(null);
        setFinalTranscript(data.text);
        setIsTranscribing(false);
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        resolveRef.current?.(data.text);
        resolveRef.current = null;
      } else if (data.type === "transcript" && data.is_final && data.text != null) {
        // Legacy message type — still supported for backwards compat
        setFinalTranscript(data.text);
        setIsTranscribing(false);
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        resolveRef.current?.(data.text);
        resolveRef.current = null;
      } else if (data.type === "transcript_refining") {
        // Re-transcription has started in the background
        setIsRefining(true);
      } else if (data.type === "transcript_refined" && data.text != null) {
        // Re-transcription complete — update transcript if quality gate selected it
        setIsRefining(false);
        setRefinedTranscript(data.text);
        setRefinementSelected(data.selected ?? null);
        // Update the displayed final transcript with the refined version
        setFinalTranscript(data.text);
      } else if (data.type === "error") {
        setError(data.message ?? "Transcription error");
        setIsTranscribing(false);
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        resolveRef.current?.("");
        resolveRef.current = null;
      }
    });

    return unsub;
  }, [onMessage]);

  const startTranscription = useCallback(
    (sessionId: string) => {
      sessionIdRef.current = sessionId;
      setSegments([]);
      setPartialText(null);
      setFinalTranscript(null);
      setError(null);
      send(JSON.stringify({ type: "transcribe_start", session_id: sessionId }));
    },
    [send],
  );

  const sendAudioChunk = useCallback(
    (chunk: Int16Array) => {
      if (connectionState !== "connected") {
        setError("Lost connection to transcription service — audio may be missing");
        return;
      }
      sendBinary(chunk);
    },
    [sendBinary, connectionState],
  );

  const reset = useCallback(() => {
    setSegments([]);
    setPartialText(null);
    setFinalTranscript(null);
    setIsRefining(false);
    setRefinedTranscript(null);
    setRefinementSelected(null);
    setError(null);
  }, []);

  const stopTranscription = useCallback((): Promise<string> => {
    const sid = sessionIdRef.current;
    if (!sid) return Promise.resolve("");

    setIsTranscribing(true);
    send(JSON.stringify({ type: "transcribe_stop", session_id: sid }));

    return new Promise<string>((resolve) => {
      resolveRef.current = resolve;

      // Clear any previous timeout to prevent leaks on rapid stop/start
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Safety timeout — don't hang forever if sidecar doesn't respond
      timeoutRef.current = setTimeout(() => {
        if (resolveRef.current === resolve) {
          setError("Transcription timed out");
          setIsTranscribing(false);
          resolveRef.current = null;
          resolve("");
        }
        timeoutRef.current = null;
      }, 120_000); // 2 minutes for long recordings
    });
  }, [send]);

  return {
    segments,
    liveTranscript,
    finalTranscript,
    isTranscribing,
    isRefining,
    refinedTranscript,
    refinementSelected,
    error,
    startTranscription,
    stopTranscription,
    sendAudioChunk,
    reset,
  };
}
