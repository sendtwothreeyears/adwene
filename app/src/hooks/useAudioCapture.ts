import { useState, useRef, useCallback, useEffect } from "react";
import { getAudioGain } from "../lib/audioGain";

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
  /** Number of PCM chunks received (read from ref — does not trigger re-renders). */
  chunkCount: () => number;
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
  const chunkCountRef = useRef(0);
  const [sampleRate, setSampleRate] = useState<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);

  const cleanup = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (compressorNodeRef.current) {
      compressorNodeRef.current.disconnect();
      compressorNodeRef.current = null;
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
    (deviceId?: string | null) => {
      // Read gain from localStorage directly (not React state) to keep [] deps valid
      const gain = getAudioGain();
      return {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: gain > 1.0 ? false : true,
        channelCount: 1,
      };
    },
    []
  );

  const start = useCallback(async () => {
    if (audioContextRef.current) return;

    try {
      setError(null);
      chunkCountRef.current = 0;

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

      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      // Create gain + compressor chain for user-controlled mic boost.
      // Graph: source → gainNode → compressor → workletNode
      const gain = getAudioGain();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = gain;
      gainNodeRef.current = gainNode;

      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -6;
      compressor.knee.value = 12;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.1;
      compressorNodeRef.current = compressor;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(workletNode);
      sourceNodeRef.current = source;

      // Listen for PCM chunks from the worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === "chunk") {
          const pcm = event.data.pcm as Int16Array;
          onChunkRef.current?.(pcm);
          chunkCountRef.current += 1;
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

        // Connect new source to the existing gain chain — zero gap.
        // The gainNode → compressor → workletNode chain persists from start().
        streamRef.current = newStream;
        const newSource = audioContext.createMediaStreamSource(newStream);
        const target = gainNodeRef.current ?? workletNode;
        newSource.connect(target);
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
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        node.port.removeEventListener("message", onFlushDone);
        cleanup();
        setState("idle");
        resolve();
      };

      const onFlushDone = (event: MessageEvent) => {
        if (event.data.type === "flush-done") {
          clearTimeout(timeoutId);
          settle();
        }
      };

      node.port.addEventListener("message", onFlushDone);
      node.port.postMessage("flush");

      // Safety timeout — if flush-done never arrives, clean up anyway
      const timeoutId = setTimeout(settle, 1000);
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
    chunkCount: () => chunkCountRef.current,
    sampleRate,
    start,
    stop,
    switchDevice,
  };
}
