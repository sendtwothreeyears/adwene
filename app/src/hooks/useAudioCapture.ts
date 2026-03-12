import { useState, useRef, useCallback, useEffect } from "react";

type CaptureState = "idle" | "recording" | "error";

interface UseAudioCaptureReturn {
  state: CaptureState;
  error: string | null;
  audioLevel: number;
  chunks: Int16Array[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [chunks, setChunks] = useState<Int16Array[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (audioContextRef.current) return;

    try {
      setError(null);
      setChunks([]);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // Create AudioContext and load worklet
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/pcm-processor.js");

      // Create worklet node and connect microphone
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);

      // Listen for messages from the worklet
      workletNode.port.onmessage = (event) => {
        const { type } = event.data;
        if (type === "chunk") {
          const pcm = event.data.pcm as Int16Array;
          console.log(`[useAudioCapture] PCM chunk: ${pcm.length} samples`);
          setChunks((prev) => [...prev, pcm]);
        } else if (type === "level") {
          // Clamp RMS to 0–1 range
          setAudioLevel(Math.min(1, event.data.rms));
        }
      };

      setState("recording");
    } catch (err) {
      cleanup();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "No microphone found"
            : err instanceof Error
              ? err.message
              : "Failed to start recording";
      setError(message);
      setState("error");
    }
  }, [cleanup]);

  const stop = useCallback(async () => {
    const node = workletNodeRef.current;
    if (!node) return;

    // Flush remaining samples from the worklet
    return new Promise<void>((resolve) => {
      const onFlushDone = (event: MessageEvent) => {
        if (event.data.type === "flush-done") {
          node.port.removeEventListener("message", onFlushDone);
          cleanup();
          setState("idle");
          resolve();
        }
      };

      node.port.addEventListener("message", onFlushDone);
      node.port.postMessage("flush");

      // Safety timeout — if flush-done never arrives, clean up anyway
      setTimeout(() => {
        cleanup();
        setState("idle");
        resolve();
      }, 1000);
    });
  }, [cleanup]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { state, error, audioLevel, chunks, start, stop };
}
