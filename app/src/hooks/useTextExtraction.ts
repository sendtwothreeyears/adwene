import { useCallback, useEffect, useRef } from "react";
import { useSidecar } from "../contexts/SidecarContext";

interface PendingRequest {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

/**
 * Hook for extracting text from files via the sidecar.
 * Sends extract_text messages with request_id and matches responses.
 */
export function useTextExtraction() {
  const { send, onMessage } = useSidecar();
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  // Subscribe to text_extracted messages
  useEffect(() => {
    const unsub = onMessage((raw: string) => {
      let data: { type: string; request_id?: string; text?: string; error?: string | null };
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      if (data.type !== "text_extracted") return;

      const requestId = data.request_id;
      if (!requestId) return;

      const pending = pendingRef.current.get(requestId);
      if (!pending) return;

      pendingRef.current.delete(requestId);

      if (data.error) {
        pending.reject(new Error(data.error));
      } else {
        pending.resolve(data.text ?? "");
      }
    });

    return unsub;
  }, [onMessage]);

  // Clean up pending requests on unmount
  useEffect(() => {
    return () => {
      for (const [, pending] of pendingRef.current) {
        pending.reject(new Error("Component unmounted"));
      }
      pendingRef.current.clear();
    };
  }, []);

  const extractText = useCallback(
    (filePath: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        pendingRef.current.set(requestId, { resolve, reject });

        send(
          JSON.stringify({
            type: "extract_text",
            request_id: requestId,
            file_path: filePath,
          })
        );

        // Timeout after 30 seconds
        setTimeout(() => {
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pendingRef.current.delete(requestId);
            pending.reject(new Error("Text extraction timed out"));
          }
        }, 30_000);
      });
    },
    [send]
  );

  return { extractText };
}
