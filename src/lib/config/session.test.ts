import { describe, it, expect } from "vitest";
import { serializeSession, parseSession } from "./session";

describe("session persistence", () => {
  it("round-trips untitled buffers", () => {
    const items = [
      { name: "bez názvu 1", content: "rozepsaná poznámka" },
      { name: "bez názvu 2", content: "" },
    ];
    expect(parseSession(serializeSession(items))).toEqual(items);
  });

  it("drops malformed entries", () => {
    const raw = JSON.stringify({
      untitled: [{ name: "ok", content: "x" }, { name: 5 }, "nope", null],
    });
    expect(parseSession(raw)).toEqual([{ name: "ok", content: "x" }]);
  });

  it("returns empty for invalid or unexpected JSON", () => {
    expect(parseSession("{ broken")).toEqual([]);
    expect(parseSession("42")).toEqual([]);
    expect(parseSession(JSON.stringify({}))).toEqual([]);
  });
});
