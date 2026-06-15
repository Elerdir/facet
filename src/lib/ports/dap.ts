/**
 * Transport for Debug Adapter Protocol adapters — a pipe to a child process.
 * Production spawns the adapter via Rust; tests use an in-memory fake. All DAP
 * protocol logic lives above this in the (tested) `DebugManager`.
 */
export interface DapTransport {
  start(id: string, command: string, args: string[], cwd: string): Promise<void>;
  send(id: string, bytes: Uint8Array): Promise<void>;
  stop(id: string): Promise<void>;
  /** Raw bytes from an adapter's stdout. Returns an unsubscribe function. */
  onData(handler: (id: string, bytes: Uint8Array) => void): () => void;
  /** An adapter process exited. Returns an unsubscribe function. */
  onExit(handler: (id: string) => void): () => void;
}
