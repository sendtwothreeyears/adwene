import { useEffect, useRef } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  variant?: "success" | "error";
  /** Auto-dismiss after this many milliseconds. Default: 3000. */
  duration?: number;
}

export default function Toast({
  message,
  visible,
  onDismiss,
  variant = "success",
  duration = 3000,
}: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Auto-dismiss after duration — uses ref to avoid timer reset on re-render
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [visible, duration]);

  if (!visible) return null;

  const isSuccess = variant === "success";

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-slide-up">
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 shadow-lg ${
          isSuccess
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
        }`}
      >
        {isSuccess ? (
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 rounded p-0.5 hover:bg-white/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
