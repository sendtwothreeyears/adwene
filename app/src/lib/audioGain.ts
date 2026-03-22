const STORAGE_KEY = "kasamd:audio-gain";
const MIN_GAIN = 1.0;
const MAX_GAIN = 3.0;
const DEFAULT_GAIN = 1.0;

export function getAudioGain(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_GAIN;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) return DEFAULT_GAIN;
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, parsed));
}

export function setAudioGain(value: number): void {
  const clamped = Math.min(MAX_GAIN, Math.max(MIN_GAIN, value));
  localStorage.setItem(STORAGE_KEY, clamped.toFixed(1));
}
