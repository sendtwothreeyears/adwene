import { useState, useEffect, useRef, useCallback } from "react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function useRecordingTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const start = useCallback(() => {
    setElapsedSeconds(0);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    startTimeRef.current = null;
    setElapsedSeconds(0);
  }, []);

  return {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    isRunning,
    start,
    stop,
  };
}
