import { useState } from "react";
import { Mic, Square } from "lucide-react";

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

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        isDisabled
          ? "cursor-not-allowed bg-gray-100 text-gray-400"
          : isRecording
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-button text-white hover:bg-button-hover"
      }`}
    >
      {isRecording ? (
        <>
          <Square className="h-3.5 w-3.5" />
          Stop
        </>
      ) : (
        <>
          <Mic className="h-4 w-4" />
          Record
        </>
      )}
    </button>
  );
}
