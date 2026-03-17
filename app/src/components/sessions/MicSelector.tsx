import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, ChevronDown, Check } from "lucide-react";
import type { AudioDevice } from "../../hooks/useAudioDevices";

type PermissionState = "prompt" | "granted" | "denied" | "unknown";

interface MicSelectorProps {
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  permissionState: PermissionState;
  onSelectDevice: (deviceId: string | null) => void;
  onRequestPermission: () => void;
}

export default function MicSelector({
  devices,
  selectedDeviceId,
  permissionState,
  onSelectDevice,
  onRequestPermission,
}: MicSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // Pre-permission state
  if (permissionState === "prompt" || permissionState === "unknown") {
    return (
      <button
        onClick={onRequestPermission}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <Mic className="h-3.5 w-3.5" />
        Allow Microphone
      </button>
    );
  }

  // Permission denied
  if (permissionState === "denied") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-500">
        <MicOff className="h-3.5 w-3.5" />
        Mic blocked
      </span>
    );
  }

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId);
  const displayLabel = selectedDevice?.label ?? "System Default";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <Mic className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">{displayLabel}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {/* System Default */}
          <button
            onClick={() => { onSelectDevice(null); handleClose(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50"
          >
            <span className="w-3.5">
              {selectedDeviceId === null && <Check className="h-3.5 w-3.5 text-blue-600" />}
            </span>
            System Default
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-gray-100" />

          {/* Device list */}
          {devices.map((device) => (
            <button
              key={device.deviceId}
              onClick={() => { onSelectDevice(device.deviceId); handleClose(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50"
            >
              <span className="w-3.5">
                {selectedDeviceId === device.deviceId && (
                  <Check className="h-3.5 w-3.5 text-blue-600" />
                )}
              </span>
              <span className="truncate">{device.label}</span>
            </button>
          ))}

          {devices.length === 0 && (
            <span className="block px-3 py-1.5 text-xs text-gray-400">
              No microphones found
            </span>
          )}


        </div>
      )}
    </div>
  );
}
