import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LspTransport } from "../ports/lsp";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** LspTransport backed by the Rust `lsp_*` commands + `lsp:data`/`lsp:exit` events. */
export class TauriLsp implements LspTransport {
  start(id: string, command: string, args: string[], cwd: string): Promise<void> {
    return invoke<void>("lsp_start", { id, command, args, cwd });
  }

  send(id: string, bytes: Uint8Array): Promise<void> {
    return invoke<void>("lsp_send", { id, data: bytesToBase64(bytes) });
  }

  stop(id: string): Promise<void> {
    return invoke<void>("lsp_stop", { id });
  }

  onData(handler: (id: string, bytes: Uint8Array) => void): () => void {
    const un = listen<{ id: string; data: string }>("lsp:data", (e) =>
      handler(e.payload.id, base64ToBytes(e.payload.data)),
    );
    return () => void un.then((f) => f());
  }

  onExit(handler: (id: string) => void): () => void {
    const un = listen<string>("lsp:exit", (e) => handler(e.payload));
    return () => void un.then((f) => f());
  }
}
