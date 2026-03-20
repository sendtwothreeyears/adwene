import { useEffect, useRef } from "react";

type WaveformMode = "bars" | "rolling";

interface WaveformProps {
  audioStream: MediaStream | null;
  mode?: WaveformMode;
}

const BAR_COUNT = 5;
const AMPLIFIERS = [2.0, 3.3, 5.2, 3.3, 2.0]; // Center-peaked pattern (boosted for 15% freq range)

const ROLLING_SAMPLE_COUNT = 50;
const ROLLING_BAR_WIDTH = 3; // px bar width
const ROLLING_GAP = 2; // px between bars

export default function Waveform({ audioStream, mode = "bars" }: WaveformProps) {
  const animationRef = useRef<number>(undefined);
  const analyserRef = useRef<AnalyserNode>(undefined);
  const dataArrayRef = useRef<Uint8Array>(undefined);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<number[]>(new Array(ROLLING_SAMPLE_COUNT).fill(0));
  const lastDrawRef = useRef(0);

  useEffect(() => {
    // Reset samples when mode changes
    samplesRef.current = new Array(ROLLING_SAMPLE_COUNT).fill(0);
  }, [mode]);

  useEffect(() => {
    if (!audioStream) {
      if (mode === "bars") {
        barRefs.current.forEach((el) => {
          if (el) el.style.height = "12%";
        });
      } else {
        // Clear canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        samplesRef.current = new Array(ROLLING_SAMPLE_COUNT).fill(0);
      }
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

      if (mode === "bars") {
        const usableRange = Math.floor(bufferLength * 0.15);
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
      } else {
        // Rolling mode: compute average amplitude and push to buffer
        const usableRange = Math.floor(bufferLength * 0.15);
        let sum = 0;
        for (let i = 0; i < usableRange; i++) {
          sum += dataArrayRef.current[i];
        }
        const average = sum / usableRange / 255;
        // Amplify for visual presence (average is ~1.2-1.4x higher than RMS)
        const amplitude = Math.min(average * 4.0, 1);

        // Shift buffer left and push new sample
        samplesRef.current.shift();
        samplesRef.current.push(amplitude);

        // Draw on canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(dpr, dpr);

        const samples = samplesRef.current;
        const barStep = ROLLING_BAR_WIDTH + ROLLING_GAP;
        // Right-align: newest samples at the right edge
        const startX = w - samples.length * barStep;

        for (let i = 0; i < samples.length; i++) {
          const amp = samples[i];
          const x = startX + i * barStep;
          const centerY = h / 2;

          // Bar height scales with amplitude, minimum visible height
          const barHeight = Math.max(amp * h * 0.85, 2);
          // Opacity: minimum 0.3 so silent sections are still faintly visible
          const opacity = 0.3 + amp * 0.7;

          const barRadius = ROLLING_BAR_WIDTH / 2;
          const y = centerY - barHeight / 2;

          // Draw rounded rect (vertical bar)
          ctx.beginPath();
          ctx.roundRect(x, y, ROLLING_BAR_WIDTH, barHeight, barRadius);
          ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`; // red-500
          ctx.fill();
        }

        ctx.restore();
      }
    };

    animationRef.current = requestAnimationFrame(updateWaveform);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [audioStream, mode]);

  // Set up canvas DPR scaling with resize observation
  useEffect(() => {
    if (mode !== "rolling") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mode]);

  if (mode === "rolling") {
    return (
      <canvas
        ref={canvasRef}
        className="h-8 w-full"
      />
    );
  }

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
