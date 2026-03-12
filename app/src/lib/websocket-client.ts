export type ConnectionState = "connecting" | "connected" | "disconnected";
export type MessageHandler = (data: string) => void;
export type StateHandler = (state: ConnectionState) => void;

const INITIAL_RECONNECT_MS = 500;
const MAX_RECONNECT_MS = 10_000;

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private messageHandlers = new Set<MessageHandler>();
  private stateHandlers = new Set<StateHandler>();
  private _state: ConnectionState = "disconnected";
  private disposed = false;

  constructor(url: string) {
    this.url = url;
  }

  get state(): ConnectionState {
    return this._state;
  }

  connect(): void {
    if (this.disposed) return;
    this.cleanup();
    this.setState("connecting");

    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      this.setState("connected");
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        this.messageHandlers.forEach((h) => h(event.data));
      }
    };

    ws.onclose = () => {
      this.setState("disconnected");
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror, so reconnect is handled there
    };

    this.ws = ws;
  }

  send(message: string | Blob | BufferSource): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  dispose(): void {
    this.disposed = true;
    this.cleanup();
    this.messageHandlers.clear();
    this.stateHandlers.clear();
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    this.stateHandlers.forEach((h) => h(state));
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
  }
}
