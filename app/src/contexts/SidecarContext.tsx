import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  WebSocketClient,
  type ConnectionState,
  type MessageHandler,
} from "../lib/websocket-client";

const SIDECAR_URL = "ws://localhost:8765";

interface SidecarContextValue {
  connectionState: ConnectionState;
  send: (message: string) => void;
  sendBinary: (data: ArrayBuffer | ArrayBufferView<ArrayBuffer>) => void;
  onMessage: (handler: MessageHandler) => () => void;
}

const SidecarContext = createContext<SidecarContextValue | null>(null);

export function SidecarProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<WebSocketClient | null>(null);
  const handlersRef = useRef(new Set<MessageHandler>());
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  useEffect(() => {
    const client = new WebSocketClient(SIDECAR_URL);
    clientRef.current = client;
    client.onStateChange(setConnectionState);

    // Forward all client messages to registered handlers.
    // Handlers are stored in a ref so they can be registered before the
    // client exists (child effects fire before parent effects in React).
    client.onMessage((data) => {
      handlersRef.current.forEach((h) => h(data));
    });

    client.connect();

    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  const send = useCallback((message: string) => {
    clientRef.current?.send(message);
  }, []);

  const sendBinary = useCallback((data: ArrayBuffer | ArrayBufferView<ArrayBuffer>) => {
    clientRef.current?.send(data);
  }, []);

  const onMessage = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  return (
    <SidecarContext.Provider value={{ connectionState, send, sendBinary, onMessage }}>
      {children}
    </SidecarContext.Provider>
  );
}

export function useSidecar(): SidecarContextValue {
  const ctx = useContext(SidecarContext);
  if (!ctx) {
    throw new Error("useSidecar must be used within a SidecarProvider");
  }
  return ctx;
}
