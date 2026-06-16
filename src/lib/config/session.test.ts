import { describe, it, expect } from "vitest";
import { serializeSession, parseSession, EMPTY_SESSION } from "./session";

describe("session persistence", () => {
  it("round-trips the full session data", () => {
    const data = {
      untitled: [{ name: "bez názvu 1", content: "rozepsaná poznámka" }],
      folder: "E:/Projects/facet",
      folders: ["E:/Projects/facet"],
      files: ["E:/Projects/facet/src/App.svelte", "E:/Projects/facet/README.md"],
      activePath: "E:/Projects/facet/README.md",
    };
    expect(parseSession(serializeSession(data))).toEqual(data);
  });

  it("tolerates the legacy format with only untitled buffers", () => {
    const raw = JSON.stringify({ untitled: [{ name: "ok", content: "x" }] });
    expect(parseSession(raw)).toEqual({
      untitled: [{ name: "ok", content: "x" }],
      folder: null,
      folders: [],
      files: [],
      activePath: null,
    });
  });

  it("drops malformed entries", () => {
    const raw = JSON.stringify({
      untitled: [{ name: "ok", content: "x" }, { name: 5 }, "nope", null],
      files: ["E:/a.ts", 42, "", null],
      folder: 7,
      activePath: "",
    });
    const parsed = parseSession(raw);
    expect(parsed.untitled).toEqual([{ name: "ok", content: "x" }]);
    expect(parsed.files).toEqual(["E:/a.ts"]);
    expect(parsed.folder).toBeNull();
    expect(parsed.activePath).toBeNull();
  });

  it("returns an empty session for invalid or unexpected JSON", () => {
    expect(parseSession("{ broken")).toEqual(EMPTY_SESSION);
    expect(parseSession("42")).toEqual(EMPTY_SESSION);
    expect(parseSession(JSON.stringify({}))).toEqual(EMPTY_SESSION);
  });
});
