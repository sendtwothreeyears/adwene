/** Shimmer skeleton that mimics the SessionView layout while a session is being created. */
export default function SessionSkeleton() {
  return (
    <div className="flex h-full flex-col animate-pulse">
      {/* Top bar: patient picker + record button area */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-5 w-5 rounded bg-gray-200" />
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 rounded-md bg-gray-200" />
        </div>
      </div>

      {/* Title placeholder */}
      <div className="mt-2 h-4 w-48 rounded bg-gray-200" />

      {/* Tab bar */}
      <div className="mt-4 flex gap-4 border-b border-gray-200 pb-2">
        <div className="h-4 w-16 rounded bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-12 rounded bg-gray-200" />
      </div>

      {/* Editor content area */}
      <div className="mt-4 flex-1 space-y-3">
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-4/6 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-2/3 rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
      </div>
    </div>
  );
}
