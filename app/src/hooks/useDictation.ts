/**
 * useDictation — orchestrates the dictation flow: starts/stops audio capture,
 * communicates with the sidecar via the shared WebSocket connection, and
 * exposes state for the DictationPlugin and button.
 *
 * Dictation and live recording are mutually exclusive (enforced in the UI),
 * so this hook safely creates its own audio capture instance.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useSidecar } from "../contexts/SidecarContext";
import { useAudioCapture } from "./useAudioCapture";

export interface UseDictationReturn {
  /** True while the user is actively recording audio for dictation. */
  isDictating: boolean;
  /** True while the sidecar is processing dictation audio. */
  isProcessing: boolean;
  /** The transcribed text (null until transcription completes). */
  transcribedText: string | null;
  /** Error message if dictation fails. */
  error: string | null;
  /** Start dictation for the given session. */
  startDictation: (sessionId: string) => void;
  /** Stop recording and send audio for transcription. */
  stopDictation: () => void;
  /** Cancel dictation without processing. */
  cancelDictation: () => void;
  /** Reset state after the plugin has consumed the result. */
  reset: () => void;
}

export function useDictation(
  deviceId?: string | null,
): UseDictationReturn {
  const { send, sendBinary, onMessage, connectionState } = useSidecar();

  const [isDictating, setIsDictating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio capture instance — routes chunks as binary frames to sidecar.
  // The onChunk callback uses sendBinary directly (same binary frame format
  // as live transcription). The sidecar routes binary frames to dictation
  // when a dictation session is active.
  const {
    start: startCapture,
    stop: stopCapture,
  } = useAudioCapture({
    onChunk: useCallback(
      (chunk: Int16Array) => {
        if (connectionState !== "connected") return;
        sendBinary(chunk);
      },
      [sendBinary, connectionState],
    ),
    deviceId,
  });

  // Subscribe to sidecar dictation messages
  useEffect(() => {
    const unsub = onMessage((raw: string) => {
      let data: {
        type: string;
        session_id?: string;
        text?: string;
        error?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      // Only handle dictation messages for our session
      if (data.session_id && data.session_id !== sessionIdRef.current) return;

      if (data.type === "dictate_result") {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsProcessing(false);
        setTranscribedText(data.text ?? "");
      } else if (data.type === "dictate_error") {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsProcessing(false);
        setIsDictating(false);
        setError(data.error ?? "Dictation failed");
      }
    });

    return unsub;
  }, [onMessage]);

  const startDictation = useCallback(
    (sessionId: string) => {
      sessionIdRef.current = sessionId;
      setIsDictating(true);
      setIsProcessing(false);
      setTranscribedText(null);
      setError(null);

      send(JSON.stringify({ type: "dictate_start", session_id: sessionId }));
      startCapture();
    },
    [send, startCapture],
  );

  const stopDictation = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    stopCapture();
    setIsDictating(false);
    setIsProcessing(true);

    send(JSON.stringify({ type: "dictate_stop", session_id: sid }));

    // Safety timeout — don't hang if sidecar doesn't respond
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
      setError("Dictation timed out");
      timeoutRef.current = null;
    }, 60_000); // 1 minute for dictation (shorter than full transcription)
  }, [send, stopCapture]);

  const cancelDictation = useCallback(() => {
    const sid = sessionIdRef.current;
    stopCapture();
    setIsDictating(false);
    setIsProcessing(false);
    setTranscribedText(null);
    setError(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Tell sidecar to stop (it will discard any accumulated audio)
    if (sid) {
      send(JSON.stringify({ type: "dictate_stop", session_id: sid }));
    }
    sessionIdRef.current = null;
  }, [send, stopCapture]);

  const reset = useCallback(() => {
    setTranscribedText(null);
    setError(null);
    sessionIdRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isDictating,
    isProcessing,
    transcribedText,
    error,
    startDictation,
    stopDictation,
    cancelDictation,
    reset,
  };
}
