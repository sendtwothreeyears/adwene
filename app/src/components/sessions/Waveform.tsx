import { useEffect, useRef } from "react";

interface WaveformProps {
  audioStream: MediaStream | null;
}

const BAR_COUNT = 5;
const AMPLIFIERS = [1.5, 2.5, 4.0, 2.5, 1.5]; // Center-peaked pattern

export default function Waveform({ audioStream }: WaveformProps) {
  const animationRef = useRef<number>(undefined);
  const analyserRef = useRef<AnalyserNode>(undefined);
  const dataArrayRef = useRef<Uint8Array>(undefined);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastDrawRef = useRef(0);

  useEffect(() => {
    if (!audioStream) {
      barRefs.current.forEach((el) => {
        if (el) el.style.height = "12%";
      });
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    source.connect(analyser);

    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    dataArrayRef.current = dataArray;

    const updateWaveform = (now: number) => {
      animationRef.current = requestAnimationFrame(updateWaveform);

      // Throttle to ~30fps
      if (now - lastDrawRef.current < 33) return;
      lastDrawRef.current = now;

      if (!analyserRef.current || !dataArrayRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      const usableRange = Math.floor(bufferLength * 0.07);
      const samplesPerBar = Math.floor(usableRange / BAR_COUNT);

      for (let i = 0; i < BAR_COUNT; i++) {
        const start = i * samplesPerBar;
        const end = start + samplesPerBar;
        const slice = dataArrayRef.current.slice(start, end);
        const average =
          slice.reduce((sum, val) => sum + val, 0) / slice.length;
        const amplified = (average / 255) * AMPLIFIERS[i];
        const height = Math.max(Math.min(amplified, 1) * 100, 12);
        const el = barRefs.current[i];
        if (el) el.style.height = `${height}%`;
      }
    };

    animationRef.current = requestAnimationFrame(updateWaveform);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [audioStream]);

  return (
    <div className="flex h-4 items-center justify-center gap-0.5">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => { barRefs.current[i] = el; }}
          className="self-center rounded-full bg-green-500 transition-all duration-100 ease-out"
          style={{
            width: "4px",
            height: "12%",
          }}
        />
      ))}
    </div>
  );
}
