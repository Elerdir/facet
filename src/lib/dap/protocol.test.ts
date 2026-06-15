import { describe, it, expect } from "vitest";
import { encodeDap, DapBuffer, type DapMessage } from "./protocol";

describe("DAP protocol framing", () => {
  it("round-trips a request through encode/decode", () => {
    const msg: DapMessage = {
      seq: 1,
      type: "request",
      command: "initialize",
      arguments: { adapterID: "debugpy", háčky: "ěščř" },
    };
    const buf = new DapBuffer();
    const out = buf.append(encodeDap(msg));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ seq: 1, type: "request", command: "initialize" });
  });

  it("reassembles a message split across chunks", () => {
    const bytes = encodeDap({ seq: 7, type: "event", event: "stopped" });
    const buf = new DapBuffer();
    expect(buf.append(bytes.subarray(0, 12))).toEqual([]);
    const out = buf.append(bytes.subarray(12));
    expect(out[0]).toMatchObject({ seq: 7, type: "event", event: "stopped" });
  });

  it("yields multiple coalesced messages in one chunk", () => {
    const a = encodeDap({ seq: 1, type: "response", request_seq: 1, success: true });
    const b = encodeDap({ seq: 2, type: "event", event: "terminated" });
    const merged = new Uint8Array(a.length + b.length);
    merged.set(a, 0);
    merged.set(b, a.length);
    const out = new DapBuffer().append(merged);
    expect(out.map((m) => m.type)).toEqual(["response", "event"]);
  });
});
