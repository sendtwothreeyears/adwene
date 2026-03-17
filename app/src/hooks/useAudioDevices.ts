import { useState, useCallback, useEffect, useRef } from "react";

export interface AudioDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

type PermissionState = "prompt" | "granted" | "denied" | "unknown";

const STORAGE_KEY = "adwene:preferred-mic";

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [permissionState, setPermissionState] =
    useState<PermissionState>("unknown");

  const mountedRef = useRef(true);

  const enumerate = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
          groupId: d.groupId,
        }));

      if (!mountedRef.current) return;
      setDevices(inputs);

      // If the persisted device is no longer available, reset to system default
      const persisted = localStorage.getItem(STORAGE_KEY);
      if (persisted && !inputs.some((d) => d.deviceId === persisted)) {
        localStorage.removeItem(STORAGE_KEY);
        setSelectedDeviceId(null);
      }
    } catch {
      // enumerateDevices can fail in insecure contexts — ignore
    }
  }, []);

  const refreshDevices = useCallback(() => enumerate(), [enumerate]);

  const selectDevice = useCallback((deviceId: string | null) => {
    if (deviceId) {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSelectedDeviceId(deviceId);
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately — we only wanted the permission grant
      stream.getTracks().forEach((t) => t.stop());
      setPermissionState("granted");
      await enumerate();
    } catch {
      setPermissionState("denied");
    }
  }, [enumerate]);

  // Query permission state passively on mount
  useEffect(() => {
    let permStatus: PermissionStatus | null = null;

    const handleChange = () => {
      if (!mountedRef.current) return;
      const state = permStatus?.state;
      if (state === "granted" || state === "denied" || state === "prompt") {
        setPermissionState(state);
        if (state === "granted") enumerate();
      }
    };

    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (!mountedRef.current) return;
        permStatus = status;
        handleChange();
        status.addEventListener("change", handleChange);
      })
      .catch(() => {
        // permissions API not available — stay "unknown"
      });

    return () => {
      permStatus?.removeEventListener("change", handleChange);
    };
  }, [enumerate]);

  // Enumerate on mount and listen for device changes
  useEffect(() => {
    enumerate();

    const handler = () => enumerate();
    navigator.mediaDevices.addEventListener("devicechange", handler);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, [enumerate]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    devices,
    selectedDeviceId,
    permissionState,
    selectDevice,
    refreshDevices,
    requestPermission,
  };
}
