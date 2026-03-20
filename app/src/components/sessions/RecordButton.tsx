import { useState } from "react";
import { Mic } from "lucide-react";

interface RecordButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}

export default function RecordButton({
  isRecording,
  disabled,
  onStart,
  onStop,
}: RecordButtonProps) {
  const [transitioning, setTransitioning] = useState(false);
  const isDisabled = transitioning || disabled;

  async function handleClick() {
    setTransitioning(true);
    try {
      if (isRecording) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setTransitioning(false);
    }
  }

  if (isRecording) {
    return (
      <button
        onClick={handleClick}
        disabled={isDisabled}
        aria-label="Stop transcription"
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
          isDisabled
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-gray-100 text-black hover:bg-gray-200"
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="animate-pulse">
          <circle cx="5" cy="5" r="4" fill="#ef4444" />
        </svg>
        Stop Transcription
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      aria-label="Create transcription"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        isDisabled
          ? "cursor-not-allowed bg-gray-100 text-gray-400"
          : "bg-button text-white hover:bg-button-hover"
      }`}
    >
      <Mic className="h-4 w-4" />
      Create Transcription
    </button>
  );
}
