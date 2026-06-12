import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Pipe to a real PTY shell session in Rust (ConPTY on Windows). */
export class TauriTerminal {
  start(id: string, shell: "powershell" | "cmd", cwd: string | null, cols: number, rows: number) {
    return invoke<void>("term_start", { id, shell, cwd, cols, rows });
  }

  write(id: string, data: string): Promise<void> {
    return invoke<void>("term_write", { id, data });
  }

  resize(id: string, cols: number, rows: number): Promise<void> {
    return invoke<void>("term_resize", { id, cols, rows });
  }

  kill(id: string): Promise<void> {
    return invoke<void>("term_kill", { id });
  }

  onData(handler: (id: string, bytes: Uint8Array) => void): () => void {
    const un = listen<{ id: string; data: string }>("term:data", (e) =>
      handler(e.payload.id, base64ToBytes(e.payload.data)),
    );
    return () => void un.then((f) => f());
  }

  onExit(handler: (id: string) => void): () => void {
    const un = listen<string>("term:exit", (e) => handler(e.payload));
    return () => void un.then((f) => f());
  }
}
