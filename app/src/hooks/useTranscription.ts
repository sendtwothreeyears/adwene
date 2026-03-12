import { useState, useRef, useCallback, useEffect } from "react";
import { useSidecar } from "../contexts/SidecarContext";

interface UseTranscriptionReturn {
  transcript: string;
  isTranscribing: boolean;
  error: string | null;
  startTranscription: (sessionId: string) => void;
  stopTranscription: () => Promise<string>;
  sendAudioChunk: (chunk: Int16Array) => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const { send, sendBinary, onMessage } = useSidecar();

  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const resolveRef = useRef<((text: string) => void) | null>(null);

  // Subscribe to sidecar messages
  useEffect(() => {
    const unsub = onMessage((raw: string) => {
      let data: { type: string; session_id?: string; text?: string; is_final?: boolean; message?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      // Only handle messages for our active session
      if (data.session_id && data.session_id !== sessionIdRef.current) return;

      if (data.type === "transcript" && data.is_final && data.text != null) {
        setTranscript(data.text);
        setIsTranscribing(false);
        resolveRef.current?.(data.text);
        resolveRef.current = null;
      } else if (data.type === "error") {
        setError(data.message ?? "Transcription error");
        setIsTranscribing(false);
        resolveRef.current?.("");
        resolveRef.current = null;
      }
    });

    return unsub;
  }, [onMessage]);

  const startTranscription = useCallback(
    (sessionId: string) => {
      sessionIdRef.current = sessionId;
      setTranscript("");
      setError(null);
      send(JSON.stringify({ type: "transcribe_start", session_id: sessionId }));
    },
    [send],
  );

  const sendAudioChunk = useCallback(
    (chunk: Int16Array) => {
      sendBinary(chunk);
    },
    [sendBinary],
  );

  const stopTranscription = useCallback((): Promise<string> => {
    const sid = sessionIdRef.current;
    if (!sid) return Promise.resolve("");

    setIsTranscribing(true);
    send(JSON.stringify({ type: "transcribe_stop", session_id: sid }));

    return new Promise<string>((resolve) => {
      resolveRef.current = resolve;

      // Safety timeout — don't hang forever if sidecar doesn't respond
      setTimeout(() => {
        if (resolveRef.current === resolve) {
          setError("Transcription timed out");
          setIsTranscribing(false);
          resolveRef.current = null;
          resolve("");
        }
      }, 120_000); // 2 minutes for long recordings
    });
  }, [send]);

  return {
    transcript,
    isTranscribing,
    error,
    startTranscription,
    stopTranscription,
    sendAudioChunk,
  };
}
