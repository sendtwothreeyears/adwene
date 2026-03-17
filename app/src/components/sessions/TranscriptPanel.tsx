import { useEffect, useRef } from "react";

interface TranscriptPanelProps {
  rawTranscript: string | null;
  isTranscribing: boolean;
}

export default function TranscriptPanel({
  rawTranscript,
  isTranscribing,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rawTranscript]);

  const hasText = rawTranscript && rawTranscript.length > 0;

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto rounded-md border border-border bg-white px-4 py-3"
    >
      {hasText && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
          {rawTranscript}
        </p>
      )}

      {isTranscribing && (
        <div className="flex items-center gap-2 pt-2 text-sm text-gray-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
          Transcribing…
        </div>
      )}

      {!hasText && !isTranscribing && (
        <p className="text-sm text-gray-400">
          Transcription will appear here during recording…
        </p>
      )}
    </div>
  );
}
