import { Paperclip, X, Loader2, AlertCircle } from "lucide-react";
import type { Attachment } from "../../types";

interface AttachmentWithStatus extends Attachment {
  /** Loading state for ongoing extraction. */
  _extracting?: boolean;
  /** Error message if extraction failed. */
  _error?: string;
}

interface ContextAttachmentsProps {
  attachments: AttachmentWithStatus[];
  onAttach: () => void;
  onRemove: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type { AttachmentWithStatus };

export default function ContextAttachments({
  attachments,
  onAttach,
  onRemove,
}: ContextAttachmentsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap px-1 py-2">
      {/* Attach button */}
      <button
        type="button"
        onClick={onAttach}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Attach file
      </button>

      {/* File chips */}
      {attachments.map((att) => (
        <div
          key={att.id}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
            att._error
              ? "border-red-200 bg-red-50 text-red-700"
              : att._extracting
                ? "border-gray-200 bg-gray-50 text-gray-500"
                : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          {att._extracting && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {att._error && (
            <AlertCircle className="h-3 w-3" />
          )}
          <span className="max-w-[150px] truncate">{att.fileName}</span>
          <span className="text-gray-400">{formatFileSize(att.fileSize)}</span>
          <button
            type="button"
            onClick={() => onRemove(att.id)}
            className="ml-0.5 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
