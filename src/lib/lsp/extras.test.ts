import { describe, it, expect } from "vitest";
import { parseInlayHints, parseHighlights } from "./extras";

describe("parseInlayHints", () => {
  it("parses string and label-part hints with padding", () => {
    const hints = parseInlayHints([
      { position: { line: 0, character: 5 }, label: ": number", paddingLeft: true },
      { position: { line: 1, character: 2 }, label: [{ value: "name" }, { value: ":" }] },
      { label: "no position" },
    ]);
    expect(hints).toHaveLength(2);
    expect(hints[0]).toMatchObject({ line: 0, character: 5, label: ": number", paddingLeft: true });
    expect(hints[1].label).toBe("name:");
  });
});

describe("parseHighlights", () => {
  it("parses ranges and skips malformed", () => {
    const hl = parseHighlights([
      { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } } },
      { nope: true },
    ]);
    expect(hl).toEqual([{ startLine: 1, startCharacter: 0, endLine: 1, endCharacter: 4 }]);
  });

  it("returns [] for non-arrays", () => {
    expect(parseHighlights(null)).toEqual([]);
  });
});
