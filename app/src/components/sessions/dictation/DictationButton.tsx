/**
 * DictationButton — mic toggle for the transcription toolbar.
 * Shows recording/processing state and drives start/stop.
 */

import { Mic, Loader2 } from "lucide-react";

interface DictationButtonProps {
  isDictating: boolean;
  isProcessing: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function DictationButton({
  isDictating,
  isProcessing,
  disabled,
  onStart,
  onStop,
}: DictationButtonProps) {
  if (isProcessing) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center rounded-lg border border-border bg-white p-2 text-gray-400 cursor-not-allowed opacity-50"
      >
        <Loader2 size={16} className="animate-spin" />
      </button>
    );
  }

  if (isDictating) {
    return (
      <button
        type="button"
        onClick={onStop}
        className="flex items-center justify-center rounded-lg border border-red-300 bg-red-50 p-2 transition-colors hover:bg-red-100"
      >
        <Mic size={16} className="animate-pulse text-red-500" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="flex items-center justify-center rounded-lg border border-border bg-white p-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Mic size={16} />
    </button>
  );
}
