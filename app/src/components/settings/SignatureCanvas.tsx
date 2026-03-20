import { useRef, useEffect, useState, useCallback } from "react";

interface SignatureCanvasProps {
  savedSignature: string | null;
  onSave: (dataUrl: string) => void;
}

export default function SignatureCanvas({
  savedSignature,
  onSave,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [editing, setEditing] = useState(!savedSignature);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // If a saved signature arrives after mount (async load), exit editing mode
  useEffect(() => {
    if (savedSignature) setEditing(false);
  }, [savedSignature]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Style
    ctx.strokeStyle = "#1d4034";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (editing) {
      setupCanvas();
    }
  }, [editing, setupCanvas]);

  function getPoint(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    lastPoint.current = getPoint(e);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPoint.current) return;

    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    setHasStrokes(true);
  }

  function handlePointerUp() {
    setIsDrawing(false);
    lastPoint.current = null;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasStrokes(false);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export as PNG with quality cap
    const dataUrl = canvas.toDataURL("image/png", 0.9);

    // Check size (~50KB limit for base64)
    if (dataUrl.length > 70000) {
      // Re-export as JPEG at lower quality if too large
      const fallback = canvas.toDataURL("image/jpeg", 0.5);
      onSave(fallback);
    } else {
      onSave(dataUrl);
    }

    setEditing(false);
    setHasStrokes(false);
  }

  if (!editing && savedSignature) {
    return (
      <div>
        <img
          src={savedSignature}
          alt="Signature"
          className="mb-3 h-24 rounded border border-gray-200 bg-white p-2"
        />
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Redraw Signature
        </button>
      </div>
    );
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="mb-3 h-32 w-full cursor-crosshair rounded border border-gray-300 bg-white touch-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasStrokes}
          className="rounded-lg bg-button px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-button-hover disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={handleClear}
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Clear
        </button>
        {savedSignature && (
          <button
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
