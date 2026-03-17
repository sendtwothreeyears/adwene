import { useState, useRef, useCallback, useEffect } from "react";

type CaptureState = "idle" | "recording" | "error";

interface UseAudioCaptureOptions {
  /** Called synchronously for every PCM chunk — bypasses React state batching. */
  onChunk?: (chunk: Int16Array) => void;
  /** Device ID to capture from. null = system default. */
  deviceId?: string | null;
}

interface UseAudioCaptureReturn {
  state: CaptureState;
  error: string | null;
  chunks: Int16Array[];
  sampleRate: number | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  switchDevice: (deviceId: string | null) => Promise<void>;
}

export function useAudioCapture(
  options?: UseAudioCaptureOptions
): UseAudioCaptureReturn {
  const onChunkRef = useRef(options?.onChunk);
  onChunkRef.current = options?.onChunk;
  const deviceIdRef = useRef(options?.deviceId);
  deviceIdRef.current = options?.deviceId;

  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<Int16Array[]>([]);
  const [sampleRate, setSampleRate] = useState<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const cleanup = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
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
    setSampleRate(null);
  }, []);

  const buildAudioConstraints = useCallback(
    (deviceId?: string | null) => ({
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      channelCount: 1,
    }),
    []
  );

  const start = useCallback(async () => {
    if (audioContextRef.current) return;

    try {
      setError(null);
      setChunks([]);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(deviceIdRef.current),
      });
      streamRef.current = stream;

      // Create AudioContext at 16kHz — Chromium's SincResampler handles
      // the native→16kHz conversion in native code (>90dB SNR), so the
      // worklet receives audio already at the target sample rate.
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      setSampleRate(audioContext.sampleRate);

      if (audioContext.sampleRate !== 16000) {
        console.warn(
          `AudioContext sample rate is ${audioContext.sampleRate}, expected 16000. Falling back to worklet resampling.`
        );
      }

      await audioContext.audioWorklet.addModule("/pcm-processor.js");

      // Create worklet node and connect microphone
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);
      sourceNodeRef.current = source;

      // Listen for PCM chunks from the worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === "chunk") {
          const pcm = event.data.pcm as Int16Array;
          console.log(`[useAudioCapture] PCM chunk: ${pcm.length} samples`);
          onChunkRef.current?.(pcm);
          setChunks((prev) => [...prev, pcm]);
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
            : err instanceof DOMException &&
                err.name === "OverconstrainedError"
              ? "Selected microphone is no longer available"
              : err instanceof Error
                ? err.message
                : "Failed to start recording";
      setError(message);
      setState("error");
    }
  }, [cleanup, buildAudioConstraints]);

  const switchDevice = useCallback(
    async (deviceId: string | null) => {
      const audioContext = audioContextRef.current;
      const workletNode = workletNodeRef.current;
      if (!audioContext || !workletNode) return;

      try {
        // Get a new stream for the requested device
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: buildAudioConstraints(deviceId),
        });

        // Disconnect and stop the old source
        if (sourceNodeRef.current) {
          sourceNodeRef.current.disconnect();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        // Connect new source to the existing worklet — zero gap
        streamRef.current = newStream;
        const newSource = audioContext.createMediaStreamSource(newStream);
        newSource.connect(workletNode);
        sourceNodeRef.current = newSource;

        setError(null);
      } catch (err) {
        // OverconstrainedError or other failure — keep the old device running
        const message =
          err instanceof DOMException && err.name === "OverconstrainedError"
            ? "Selected microphone is no longer available"
            : err instanceof Error
              ? err.message
              : "Failed to switch microphone";
        setError(message);
      }
    },
    [buildAudioConstraints]
  );

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

  return {
    state,
    error,
    chunks,
    sampleRate,
    start,
    stop,
    switchDevice,
  };
}
