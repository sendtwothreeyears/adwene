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
      className="bg-gray-50 border-l border-gray-200 z-10 overflow-hidden"
      style={{
        width: isOpen ? 420 : 0,
        transition: "width 300ms ease-in-out",
      }}
    >
      <div className="flex h-full flex-col" style={{ minWidth: 420, width: 420 }}>
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
        <div className="flex-1 overflow-auto scrollbar-hide p-6">
          <div className="space-y-6">
            {/* Section Headings */}
            <div className="flex items-start gap-3 py-3">
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
                  Bold Text = Section Headings
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  Bold lines become section headings in the generated note. Use
                  them to define the structure of your template.
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    <strong>Chief Complaint</strong>
                  </code>
                </div>
              </div>
            </div>

            {/* Dynamic Fields */}
            <div className="flex items-start gap-3 py-3">
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
                  [Brackets] = Placeholders
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  The AI replaces bracketed text with actual information from the
                  patient encounter transcript.
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    [Patient&apos;s primary reason for visit]
                  </code>
                </div>
              </div>
            </div>

            {/* AI Instructions */}
            <div className="flex items-start gap-3 py-3">
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
                  (Parentheses) = AI Instructions
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-600">
                  Parenthesized text guides the AI&apos;s behavior but is
                  stripped from the final note. Use these to control what the AI
                  includes or omits.
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="font-mono text-xs text-gray-700">
                    (Only include systems that were discussed)
                  </code>
                </div>
              </div>
            </div>

            {/* Example: Before & After */}
            <div className="border-t border-gray-200 pt-5">
              <h3 className="mb-3 font-semibold text-gray-900">
                Example: Template to Note
              </h3>

              {/* Template input */}
              <p className="mb-1.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                Template
              </p>
              <div className="mb-4 rounded-md border border-gray-200 bg-white px-3 py-2.5 space-y-1">
                <p className="font-mono text-xs text-gray-700">
                  <strong>Review of Systems</strong>
                </p>
                <p className="font-mono text-xs text-gray-700">
                  (Only include systems that were discussed)
                </p>
                <p className="font-mono text-xs text-gray-700">
                  [Relevant positive and negative findings by system]
                </p>
              </div>

              {/* Arrow */}
              <div className="mb-4 flex justify-center text-gray-400">
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
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </div>

              {/* Generated output */}
              <p className="mb-1.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                Generated Note
              </p>
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 space-y-1">
                <p className="font-mono text-xs font-semibold text-gray-700">
                  Review of Systems
                </p>
                <p className="font-mono text-xs text-gray-700">
                  Constitutional: No fever, no weight loss
                </p>
                <p className="font-mono text-xs text-gray-700">
                  Cardiovascular: Denies chest pain or palpitations
                </p>
              </div>

              {/* Legend */}
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-blue-600">Bold</span>
                  {" "}became the section heading
                </p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-amber-600">(Parentheses)</span>
                  {" "}were followed then removed
                </p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-purple-600">[Brackets]</span>
                  {" "}were replaced with transcript content
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
