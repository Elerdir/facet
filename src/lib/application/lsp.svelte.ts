import { encodeMessage, MessageBuffer, type JsonRpcMessage } from "../lsp/protocol";
import { fileUri } from "../domain/paths";
import type { ServerSpec } from "../lsp/servers";
import type { LspTransport } from "../ports/lsp";
import type { LspLocation, LspTextEdit, LspWorkspaceEdit } from "../lsp/edits";

export interface LspDiagnostic {
  line: number;
  character: number;
  endLine: number;
  endCharacter: number;
  severity: number; // 1 error, 2 warning, 3 info, 4 hint
  message: string;
}

export interface LspCompletionItem {
  label: string;
  detail?: string;
  kind?: number;
  insertText?: string;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

class Connection {
  spec: ServerSpec;
  buffer = new MessageBuffer();
  nextId = 1;
  pending = new Map<number, Pending>();
  ready: Promise<void> = Promise.resolve();
  opened = new Set<string>();
  versions = new Map<string, number>();

  constructor(spec: ServerSpec) {
    this.spec = spec;
  }
}

/**
 * Drives one or more language servers over a transport. Owns the LSP lifecycle
 * (initialize / didOpen / didChange), request correlation, and reactive
 * diagnostics. Pure logic — fully unit-testable with a fake transport.
 */
export class LspManager {
  /** Diagnostics keyed by file URI. */
  diagnostics = $state<Record<string, LspDiagnostic[]>>({});

  #transport: LspTransport;
  #conns = new Map<string, Connection>();

  constructor(transport: LspTransport) {
    this.#transport = transport;
    transport.onData((id, bytes) => this.#onData(id, bytes));
    transport.onExit((id) => this.#conns.delete(id));
  }

  async openDoc(
    spec: ServerSpec,
    path: string,
    languageId: string,
    text: string,
    cwd: string,
  ): Promise<void> {
    const conn = this.#ensure(spec, cwd);
    await conn.ready;
    const uri = fileUri(path);
    if (conn.opened.has(uri)) return;
    conn.opened.add(uri);
    conn.versions.set(uri, 1);
    this.#notify(conn, "textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  changeDoc(spec: ServerSpec, path: string, text: string): void {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return;
    const uri = fileUri(path);
    if (!conn.opened.has(uri)) return;
    const version = (conn.versions.get(uri) ?? 1) + 1;
    conn.versions.set(uri, version);
    this.#notify(conn, "textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  closeDoc(spec: ServerSpec, path: string): void {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return;
    const uri = fileUri(path);
    if (!conn.opened.delete(uri)) return;
    conn.versions.delete(uri);
    this.#notify(conn, "textDocument/didClose", { textDocument: { uri } });
  }

  async completion(
    spec: ServerSpec,
    path: string,
    line: number,
    character: number,
  ): Promise<LspCompletionItem[]> {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return [];
    await conn.ready;
    const res = await this.#request(conn, "textDocument/completion", {
      textDocument: { uri: fileUri(path) },
      position: { line, character },
    });
    const raw = Array.isArray(res)
      ? res
      : ((res as { items?: unknown[] } | null)?.items ?? []);
    return (raw as Record<string, unknown>[]).map((i) => ({
      label: String(i.label ?? ""),
      detail: typeof i.detail === "string" ? i.detail : undefined,
      kind: typeof i.kind === "number" ? i.kind : undefined,
      insertText: typeof i.insertText === "string" ? i.insertText : undefined,
    }));
  }

  async hover(
    spec: ServerSpec,
    path: string,
    line: number,
    character: number,
  ): Promise<string | null> {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return null;
    await conn.ready;
    const res = await this.#request(conn, "textDocument/hover", {
      textDocument: { uri: fileUri(path) },
      position: { line, character },
    });
    return hoverText(res);
  }

  async definition(
    spec: ServerSpec,
    path: string,
    line: number,
    character: number,
  ): Promise<LspLocation | null> {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return null;
    await conn.ready;
    const res = await this.#request(conn, "textDocument/definition", {
      textDocument: { uri: fileUri(path) },
      position: { line, character },
    });
    return parseLocation(res);
  }

  async references(
    spec: ServerSpec,
    path: string,
    line: number,
    character: number,
  ): Promise<LspLocation[]> {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return [];
    await conn.ready;
    const res = await this.#request(conn, "textDocument/references", {
      textDocument: { uri: fileUri(path) },
      position: { line, character },
      context: { includeDeclaration: true },
    });
    if (!Array.isArray(res)) return [];
    return res
      .map((loc) => parseLocation(loc))
      .filter((x): x is LspLocation => x !== null);
  }

  async rename(
    spec: ServerSpec,
    path: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<LspWorkspaceEdit | null> {
    const conn = this.#conns.get(spec.serverId);
    if (!conn) return null;
    await conn.ready;
    const res = await this.#request(conn, "textDocument/rename", {
      textDocument: { uri: fileUri(path) },
      position: { line, character },
      newName,
    });
    return parseWorkspaceEdit(res);
  }

  diagnosticsFor(path: string): LspDiagnostic[] {
    return this.diagnostics[fileUri(path)] ?? [];
  }

  // --- internals -----------------------------------------------------------

  #ensure(spec: ServerSpec, cwd: string): Connection {
    let conn = this.#conns.get(spec.serverId);
    if (!conn) {
      conn = new Connection(spec);
      this.#conns.set(spec.serverId, conn);
      const c = conn;
      conn.ready = (async () => {
        await this.#transport.start(spec.serverId, spec.command, spec.args, cwd);
        await this.#initialize(c, cwd);
      })();
    }
    return conn;
  }

  async #initialize(conn: Connection, cwd: string): Promise<void> {
    await this.#request(conn, "initialize", {
      processId: null,
      rootUri: fileUri(cwd),
      capabilities: {
        textDocument: {
          synchronization: { dynamicRegistration: false },
          completion: { completionItem: { snippetSupport: false } },
          hover: { contentFormat: ["plaintext", "markdown"] },
          publishDiagnostics: {},
        },
      },
    });
    this.#notify(conn, "initialized", {});
  }

  #request(conn: Connection, method: string, params: unknown): Promise<unknown> {
    const id = conn.nextId++;
    const promise = new Promise<unknown>((resolve, reject) =>
      conn.pending.set(id, { resolve, reject }),
    );
    void this.#transport.send(
      conn.spec.serverId,
      encodeMessage({ jsonrpc: "2.0", id, method, params }),
    );
    return promise;
  }

  #notify(conn: Connection, method: string, params: unknown): void {
    void this.#transport.send(
      conn.spec.serverId,
      encodeMessage({ jsonrpc: "2.0", method, params }),
    );
  }

  #onData(id: string, bytes: Uint8Array): void {
    const conn = this.#conns.get(id);
    if (!conn) return;
    for (const msg of conn.buffer.append(bytes)) this.#dispatch(conn, msg);
  }

  #dispatch(conn: Connection, msg: JsonRpcMessage): void {
    const id = typeof msg.id === "number" ? msg.id : null;

    // Response to one of our requests.
    if (id !== null && ("result" in msg || "error" in msg) && conn.pending.has(id)) {
      const pending = conn.pending.get(id)!;
      conn.pending.delete(id);
      if (msg.error) pending.reject(new Error(msg.error.message));
      else pending.resolve(msg.result);
      return;
    }

    // Diagnostics push.
    if (msg.method === "textDocument/publishDiagnostics") {
      const params = msg.params as {
        uri: string;
        diagnostics: Record<string, unknown>[];
      };
      this.diagnostics = {
        ...this.diagnostics,
        [params.uri]: params.diagnostics.map(toDiagnostic),
      };
      return;
    }

    // Server → client request: answer null so the server doesn't block.
    if (id !== null && msg.method) {
      void this.#transport.send(
        conn.spec.serverId,
        encodeMessage({ jsonrpc: "2.0", id, result: null }),
      );
    }
  }
}

function toDiagnostic(d: Record<string, unknown>): LspDiagnostic {
  const range = (d.range as {
    start: { line: number; character: number };
    end: { line: number; character: number };
  }) ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  return {
    line: range.start.line,
    character: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character,
    severity: typeof d.severity === "number" ? d.severity : 1,
    message: typeof d.message === "string" ? d.message : "",
  };
}

function hoverText(res: unknown): string | null {
  const contents = (res as { contents?: unknown } | null)?.contents;
  if (!contents) return null;
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((x) => (typeof x === "string" ? x : String((x as { value?: string }).value ?? "")))
      .join("\n");
  }
  const value = (contents as { value?: string }).value;
  return value ?? null;
}

type LspRange = { start: { line: number; character: number }; end?: { line: number; character: number } };

function parseLocation(res: unknown): LspLocation | null {
  const loc = Array.isArray(res) ? res[0] : res;
  if (!loc || typeof loc !== "object") return null;
  const o = loc as Record<string, unknown>;
  const uri = (o.uri ?? o.targetUri) as string | undefined;
  const range = (o.range ?? o.targetSelectionRange ?? o.targetRange) as LspRange | undefined;
  if (!uri || !range) return null;
  return { uri, line: range.start.line, character: range.start.character };
}

function toTextEdit(e: Record<string, unknown>): LspTextEdit {
  const r = (e.range as Required<LspRange>) ?? {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
  };
  return {
    startLine: r.start.line,
    startCharacter: r.start.character,
    endLine: r.end.line,
    endCharacter: r.end.character,
    newText: typeof e.newText === "string" ? e.newText : "",
  };
}

function parseWorkspaceEdit(res: unknown): LspWorkspaceEdit | null {
  if (!res || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const changes: Record<string, LspTextEdit[]> = {};

  if (o.changes && typeof o.changes === "object") {
    for (const [uri, edits] of Object.entries(o.changes as Record<string, unknown[]>)) {
      changes[uri] = (edits as Record<string, unknown>[]).map(toTextEdit);
    }
  } else if (Array.isArray(o.documentChanges)) {
    for (const dc of o.documentChanges as Record<string, unknown>[]) {
      const td = dc.textDocument as { uri?: string } | undefined;
      const edits = dc.edits as Record<string, unknown>[] | undefined;
      if (td?.uri && edits) changes[td.uri] = edits.map(toTextEdit);
    }
  }

  return Object.keys(changes).length > 0 ? { changes } : null;
}
