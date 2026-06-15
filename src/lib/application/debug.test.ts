import { describe, it, expect } from "vitest";
import { DebugManager } from "./debug.svelte";
import { FakeDapTransport } from "./testing/fakes";
import type { AdapterSpec } from "../dap/adapters";

const spec: AdapterSpec = {
  adapterId: "debugpy",
  command: "python",
  args: ["-m", "debugpy.adapter"],
  type: "python",
};

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Reply to the most recent request with the given command. */
async function respond(
  dap: FakeDapTransport,
  command: string,
  body: unknown = {},
): Promise<void> {
  const req = [...dap.sentMessages()].reverse().find((m) => m.command === command);
  if (!req) throw new Error(`Žádný odeslaný request: ${command}`);
  dap.deliver("dap", {
    seq: 1000,
    type: "response",
    request_seq: req.seq,
    command,
    success: true,
    body,
  });
  await tick();
}

function event(dap: FakeDapTransport, event: string, body?: unknown): void {
  dap.deliver("dap", { seq: 2000, type: "event", event, body });
}

describe("DebugManager", () => {
  it("drives a full launch → stop → continue → terminate session", async () => {
    const dap = new FakeDapTransport();
    const mgr = new DebugManager(dap);

    void mgr.start(spec, { request: "launch", program: "/p/a.py" }, "/p", [
      { path: "/p/a.py", lines: [2, 5] },
    ]);
    await tick();
    expect(dap.started[0]).toMatchObject({ id: "dap", command: "python" });
    expect(dap.sentMessages().some((m) => m.command === "initialize")).toBe(true);

    await respond(dap, "initialize", { supportsConfigurationDoneRequest: true });
    expect(dap.sentMessages().some((m) => m.command === "launch")).toBe(true);

    // Adapter signals it is ready for breakpoints.
    event(dap, "initialized");
    await tick();
    const sb = dap.sentMessages().find((m) => m.command === "setBreakpoints");
    expect(sb).toBeDefined();
    expect((sb!.arguments as { breakpoints: unknown[] }).breakpoints).toEqual([
      { line: 2 },
      { line: 5 },
    ]);

    await respond(dap, "setBreakpoints", { breakpoints: [] });
    expect(dap.sentMessages().some((m) => m.command === "configurationDone")).toBe(true);
    await respond(dap, "configurationDone", {});
    expect(mgr.state).toBe("running");

    // Hit a breakpoint.
    event(dap, "stopped", { threadId: 1, reason: "breakpoint" });
    await tick();
    await respond(dap, "threads", { threads: [{ id: 1, name: "main" }] });
    await respond(dap, "stackTrace", {
      stackFrames: [{ id: 11, name: "f", source: { path: "/p/a.py" }, line: 2, column: 1 }],
    });
    await respond(dap, "scopes", {
      scopes: [{ name: "Locals", variablesReference: 100, expensive: false }],
    });
    await respond(dap, "variables", {
      variables: [{ name: "x", value: "1", variablesReference: 0 }],
    });

    expect(mgr.state).toBe("stopped");
    expect(mgr.frames[0].name).toBe("f");
    expect(mgr.currentLocation).toEqual({ path: "/p/a.py", line: 2 });
    expect(mgr.scopes[0].variables[0]).toMatchObject({ name: "x", value: "1" });

    // Continue.
    mgr.continue();
    await tick();
    expect(dap.sentMessages().some((m) => m.command === "continue")).toBe(true);
    expect(mgr.state).toBe("running");

    // Program output, then exit.
    event(dap, "output", { category: "stdout", output: "ahoj" });
    await tick();
    expect(mgr.output.at(-1)).toMatchObject({ category: "stdout", text: "ahoj" });

    event(dap, "terminated");
    await tick();
    expect(mgr.state).toBe("terminated");
    expect(mgr.frames).toEqual([]);
  });

  it("acknowledges reverse requests from the adapter", async () => {
    const dap = new FakeDapTransport();
    new DebugManager(dap);
    dap.deliver("dap", { seq: 42, type: "request", command: "runInTerminal", arguments: {} });
    await tick();
    const ack = dap
      .sentMessages()
      .find((m) => m.type === "response" && m.request_seq === 42);
    expect(ack).toBeDefined();
    expect(ack!.success).toBe(true);
  });
});
