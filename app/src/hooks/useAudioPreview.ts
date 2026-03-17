import { useState, useEffect } from "react";

/**
 * Maintains a persistent MediaStream for audio visualization (waveform preview).
 * Restarts the stream whenever the selected device changes.
 * This stream is separate from the recording pipeline — it's only for the UI.
 */
export function useAudioPreview(deviceId: string | null) {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    const startStream = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!cancelled) {
          setAudioStream(stream);
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch {
        // Permission not granted or device unavailable — no preview
        if (!cancelled) setAudioStream(null);
      }
    };

    startStream();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setAudioStream(null);
    };
  }, [deviceId]);

  return audioStream;
}
