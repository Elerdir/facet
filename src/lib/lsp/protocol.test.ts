import { describe, it, expect } from "vitest";
import { encodeMessage, MessageBuffer } from "./protocol";

const decoder = new TextDecoder();

describe("encodeMessage", () => {
  it("frames a message with a byte-accurate Content-Length header", () => {
    const bytes = encodeMessage({ jsonrpc: "2.0", method: "x", params: { a: "č" } });
    const text = decoder.decode(bytes);
    const body = JSON.stringify({ jsonrpc: "2.0", method: "x", params: { a: "č" } });
    const byteLen = new TextEncoder().encode(body).length;
    expect(text.startsWith(`Content-Length: ${byteLen}\r\n\r\n`)).toBe(true);
    expect(text.endsWith(body)).toBe(true);
  });
});

describe("MessageBuffer", () => {
  it("parses a single complete message", () => {
    const buf = new MessageBuffer();
    const msgs = buf.append(encodeMessage({ jsonrpc: "2.0", id: 1, result: 42 }));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe(1);
    expect(msgs[0].result).toBe(42);
  });

  it("reassembles a message split across chunks", () => {
    const buf = new MessageBuffer();
    const full = encodeMessage({ jsonrpc: "2.0", method: "ping" });
    expect(buf.append(full.subarray(0, 10))).toHaveLength(0);
    const msgs = buf.append(full.subarray(10));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].method).toBe("ping");
  });

  it("yields multiple messages from one chunk", () => {
    const buf = new MessageBuffer();
    const a = encodeMessage({ jsonrpc: "2.0", id: 1 });
    const b = encodeMessage({ jsonrpc: "2.0", id: 2 });
    const combined = new Uint8Array(a.length + b.length);
    combined.set(a, 0);
    combined.set(b, a.length);
    const msgs = buf.append(combined);
    expect(msgs.map((m) => m.id)).toEqual([1, 2]);
  });
});
