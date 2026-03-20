import { useCallback, useEffect, useRef } from "react";
import { useSidecar } from "../contexts/SidecarContext";

interface PendingRequest {
  resolve: (data: string) => void;
  reject: (error: Error) => void;
}

/**
 * Hook for generating PDFs via the sidecar.
 * Follows the same request_id + promise map pattern as useTextExtraction.
 */
export function usePdfExport() {
  const { send, onMessage } = useSidecar();
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  // Subscribe to pdf_ready / pdf_error messages
  useEffect(() => {
    const unsub = onMessage((raw: string) => {
      let data: {
        type: string;
        request_id?: string;
        data?: string;
        error?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      if (data.type !== "pdf_ready" && data.type !== "pdf_error") return;

      const requestId = data.request_id;
      if (!requestId) return;

      const pending = pendingRef.current.get(requestId);
      if (!pending) return;

      pendingRef.current.delete(requestId);

      if (data.type === "pdf_error") {
        pending.reject(new Error(data.error ?? "PDF generation failed"));
      } else {
        pending.resolve(data.data ?? "");
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

  const generatePdf = useCallback(
    (
      html: string,
      provider: {
        firstName?: string | null;
        lastName?: string | null;
        providerType?: string | null;
        signature?: string | null;
      },
      sessionTitle?: string | null
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        pendingRef.current.set(requestId, { resolve, reject });

        send(
          JSON.stringify({
            type: "generate_pdf",
            request_id: requestId,
            html,
            provider: {
              firstName: provider.firstName ?? null,
              lastName: provider.lastName ?? null,
              providerType: provider.providerType ?? null,
              signature: provider.signature ?? null,
            },
            session_title: sessionTitle ?? null,
          })
        );

        // Timeout after 30 seconds
        setTimeout(() => {
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pendingRef.current.delete(requestId);
            pending.reject(new Error("PDF generation timed out"));
          }
        }, 30_000);
      });
    },
    [send]
  );

  return { generatePdf };
}
