interface TemplateInstructionsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function TemplateInstructionsSidebar({
  isOpen,
  onToggle,
}: TemplateInstructionsSidebarProps) {
  return (
    <div
      className={`border-l border-gray-200 bg-gradient-to-b from-gray-50 to-white overflow-hidden transition-all duration-300 z-10 ${
        isOpen ? "w-[420px]" : "w-0"
      }`}
    >
      <div className="flex h-full w-[420px] flex-col">
        {/* Header with close button */}
        <div className="p-4 pb-4">
          <button
            onClick={onToggle}
            className="flex cursor-pointer items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="14" y1="8" x2="17" y2="12" />
              <line x1="14" y1="16" x2="17" y2="12" />
            </svg>
            <span className="text-sm">Close instructions</span>
          </button>
        </div>

        {/* Helper content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Section Headings */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-blue-600"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 font-semibold text-gray-900">
                  Section Headings
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  Use simple text headings to structure your template
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    Chief Complaint
                  </code>
                </div>
              </div>
            </div>

            {/* Dynamic Fields */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-purple-600"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 font-semibold text-gray-900">
                  Dynamic Fields
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  Use{" "}
                  <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
                    [brackets]
                  </span>{" "}
                  for content from transcription
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    [Patient&apos;s current medications]
                  </code>
                </div>
              </div>
            </div>

            {/* Fixed Text */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-green-600"
                >
                  <path d="M10 10.5L12 12.5L14 10.5" />
                  <path d="M10 14.5L12 16.5L14 14.5" />
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 font-semibold text-gray-900">
                  Fixed Text
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  Use{" "}
                  <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
                    &quot;quotes&quot;
                  </span>{" "}
                  for text to include verbatim
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    &quot;Electronically signed by Dr. Smith&quot;
                  </code>
                </div>
              </div>
            </div>

            {/* AI Instructions */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-600"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 font-semibold text-gray-900">
                  AI Instructions
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  Add{" "}
                  <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
                    (guidance)
                  </span>{" "}
                  to control AI behavior
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    (Include only if symptoms mentioned)
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
