import { describe, it, expect } from "vitest";
import { LspManager } from "./lsp.svelte";
import { FakeLspTransport } from "./testing/fakes";
import { fileUri } from "../domain/paths";
import type { ServerSpec } from "../lsp/servers";

const spec: ServerSpec = {
  serverId: "ts",
  command: "typescript-language-server",
  args: ["--stdio"],
  languageId: "typescript",
};

const tick = () => new Promise((r) => setTimeout(r, 0));

async function initialized(t: FakeLspTransport, open: Promise<void>) {
  await tick();
  const init = t.sentMessages().find((m) => m.method === "initialize");
  expect(init).toBeDefined();
  t.deliver("ts", { jsonrpc: "2.0", id: init!.id, result: { capabilities: {} } });
  await open;
}

describe("LspManager", () => {
  it("initializes, opens a document and surfaces diagnostics", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "const x=1", "/proj");
    await initialized(t, open);

    expect(t.started[0]).toMatchObject({ id: "ts", command: "typescript-language-server" });
    expect(t.sentMessages().some((m) => m.method === "textDocument/didOpen")).toBe(true);

    t.deliver("ts", {
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: {
        uri: fileUri("/proj/a.ts"),
        diagnostics: [
          {
            range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } },
            severity: 1,
            message: "oops",
          },
        ],
      },
    });

    const diags = mgr.diagnosticsFor("/proj/a.ts");
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ line: 0, character: 6, severity: 1, message: "oops" });
  });

  it("requests completion and maps the items", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const completion = mgr.completion(spec, "/proj/a.ts", 0, 1);
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/completion");
    expect(req).toBeDefined();
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: { items: [{ label: "foo", kind: 3, detail: "number" }] },
    });

    const items = await completion;
    expect(items).toEqual([{ label: "foo", detail: "number", kind: 3, insertText: undefined }]);
  });

  it("resolves a definition location from a Location[] response", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const def = mgr.definition(spec, "/proj/a.ts", 0, 1);
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/definition");
    expect(req).toBeDefined();
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: [
        {
          uri: "file:///proj/b.ts",
          range: { start: { line: 3, character: 2 }, end: { line: 3, character: 5 } },
        },
      ],
    });

    expect(await def).toEqual({ uri: "file:///proj/b.ts", line: 3, character: 2 });
  });

  it("parses document symbols (outline)", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const syms = mgr.documentSymbols(spec, "/proj/a.ts");
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/documentSymbol");
    expect(req).toBeDefined();
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: [
        {
          name: "Foo",
          kind: 5,
          range: { start: { line: 1, character: 0 } },
          children: [
            { name: "bar", kind: 6, selectionRange: { start: { line: 3, character: 2 } } },
          ],
        },
      ],
    });

    const result = await syms;
    expect(result[0]).toMatchObject({ name: "Foo", kind: 5, line: 1 });
    expect(result[0].children[0]).toMatchObject({ name: "bar", line: 3 });
  });

  it("requests signature help and parses it", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const p = mgr.signatureHelp(spec, "/proj/a.ts", 0, 4);
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/signatureHelp");
    expect(req).toBeDefined();
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: {
        signatures: [{ label: "f(a: number)", parameters: [{ label: "a: number" }] }],
        activeSignature: 0,
        activeParameter: 0,
      },
    });

    const help = await p;
    expect(help?.signatures[0].label).toBe("f(a: number)");
    expect(help?.signatures[0].parameters[0].label).toBe("a: number");
  });

  it("requests code actions with diagnostics context and parses them", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const p = mgr.codeActions(
      spec,
      "/proj/a.ts",
      { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
      [{ line: 0, character: 0, endLine: 0, endCharacter: 1, severity: 1, message: "oops" }],
    );
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/codeAction");
    expect(req).toBeDefined();
    expect((req!.params as { context: { diagnostics: unknown[] } }).context.diagnostics).toHaveLength(1);

    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: [
        {
          title: "Fix it",
          kind: "quickfix",
          edit: {
            changes: {
              "file:///proj/a.ts": [
                { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: "y" },
              ],
            },
          },
        },
      ],
    });

    const actions = await p;
    expect(actions[0]).toMatchObject({ title: "Fix it", kind: "quickfix" });
    expect(actions[0].edit?.changes["file:///proj/a.ts"][0].newText).toBe("y");
  });

  it("applies a server-initiated workspace/applyEdit and confirms it", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    let received: unknown = null;
    mgr.applyEdit = async (edit) => {
      received = edit;
      return true;
    };
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: 999,
      method: "workspace/applyEdit",
      params: {
        edit: {
          changes: {
            "file:///proj/a.ts": [
              { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, newText: "z" },
            ],
          },
        },
      },
    });
    await tick();

    expect(received).not.toBeNull();
    const resp = t.sentMessages().find((m) => m.id === 999);
    expect(resp).toBeDefined();
    expect((resp!.result as { applied: boolean }).applied).toBe(true);
  });

  it("lists references from a Location[] response", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const refs = mgr.references(spec, "/proj/a.ts", 0, 1);
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/references");
    expect(req).toBeDefined();
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: [
        {
          uri: "file:///proj/a.ts",
          range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } },
        },
        {
          uri: "file:///proj/b.ts",
          range: { start: { line: 4, character: 0 }, end: { line: 4, character: 1 } },
        },
      ],
    });

    expect(await refs).toEqual([
      { uri: "file:///proj/a.ts", line: 0, character: 6 },
      { uri: "file:///proj/b.ts", line: 4, character: 0 },
    ]);
  });

  it("parses a rename workspace edit (changes map)", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "x", "/proj");
    await initialized(t, open);

    const rename = mgr.rename(spec, "/proj/a.ts", 0, 1, "novy");
    await tick();
    const req = t.sentMessages().find((m) => m.method === "textDocument/rename");
    expect(req).toBeDefined();
    expect((req!.params as { newName: string }).newName).toBe("novy");
    t.deliver("ts", {
      jsonrpc: "2.0",
      id: req!.id,
      result: {
        changes: {
          "file:///proj/a.ts": [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
              newText: "novy",
            },
          ],
        },
      },
    });

    const edit = await rename;
    expect(edit).not.toBeNull();
    expect(edit!.changes["file:///proj/a.ts"]).toEqual([
      {
        startLine: 0,
        startCharacter: 0,
        endLine: 0,
        endCharacter: 1,
        newText: "novy",
      },
    ]);
  });

  it("sends incremental didChange notifications", async () => {
    const t = new FakeLspTransport();
    const mgr = new LspManager(t);
    const open = mgr.openDoc(spec, "/proj/a.ts", "typescript", "a", "/proj");
    await initialized(t, open);

    mgr.changeDoc(spec, "/proj/a.ts", "ab");
    const change = t.sentMessages().find((m) => m.method === "textDocument/didChange");
    expect(change).toBeDefined();
    expect((change!.params as { textDocument: { version: number } }).textDocument.version).toBe(2);
  });
});
