import { useState, useEffect, useRef } from "react";

interface TranscriptPanelProps {
  rawTranscript: string | null;
  liveTranscript: string;
  finalTranscript: string | null;
  isTranscribing: boolean;
  isRecording: boolean;
}

export default function TranscriptPanel({
  rawTranscript,
  liveTranscript,
  finalTranscript,
  isTranscribing,
  isRecording,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Show live text while recording/transcribing; afterwards prefer finalTranscript
  // (set synchronously on message arrival) over rawTranscript (persisted via DB).
  // This avoids: (a) a one-frame flash before the DB save completes on first
  // recording, and (b) showing stale rawTranscript from a previous recording
  // before the new value is persisted.
  const displayText = isRecording || isTranscribing
    ? liveTranscript
    : (finalTranscript || rawTranscript || liveTranscript);
  const hasText = displayText && displayText.length > 0;
  const canCopy = hasText && !isRecording && !isTranscribing;

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayText]);

  const handleCopy = () => {
    if (!displayText) return;
    try {
      navigator.clipboard.writeText(displayText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  return (
    <div className="relative h-full rounded-md border border-border bg-white">
      {/* Copy button — fixed in top-right corner, overlaid on content */}
      <button
        type="button"
        onClick={handleCopy}
        disabled={!canCopy || isCopied}
        className="absolute top-3 right-4 z-10 flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        {isCopied ? "Copied" : "Copy"}
      </button>

      {/* Scrollable transcript content */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-4 py-3"
      >
        {hasText && (
          <p className="mr-28 max-w-[800px] font-[ui-sans-serif,system-ui,sans-serif] whitespace-pre-wrap text-base leading-relaxed text-gray-900">
            {displayText}
          </p>
        )}

        {!isRecording && isTranscribing && (
          <div className="flex items-center gap-2 pt-2 text-sm text-gray-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Finalizing transcript…
          </div>
        )}

        {!hasText && !isTranscribing && !isRecording && (
          <p className="text-base text-gray-400">
            Transcription will appear here during recording…
          </p>
        )}
      </div>
    </div>
  );
}
