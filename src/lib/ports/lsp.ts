/**
 * Transport for Language Server Protocol servers — a pipe to a child process.
 * Production spawns the server via Rust; tests use an in-memory fake. All LSP
 * protocol logic lives above this in the (tested) client.
 */
export interface LspTransport {
  start(id: string, command: string, args: string[], cwd: string): Promise<void>;
  send(id: string, bytes: Uint8Array): Promise<void>;
  stop(id: string): Promise<void>;
  /** Raw bytes from a server's stdout. Returns an unsubscribe function. */
  onData(handler: (id: string, bytes: Uint8Array) => void): () => void;
  /** A server process exited. Returns an unsubscribe function. */
  onExit(handler: (id: string) => void): () => void;
}
