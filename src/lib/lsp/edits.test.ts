import { describe, it, expect } from "vitest";
import { applyTextEdits } from "./edits";

describe("applyTextEdits", () => {
  it("applies a single same-line edit", () => {
    expect(
      applyTextEdits("hello world", [
        { startLine: 0, startCharacter: 6, endLine: 0, endCharacter: 11, newText: "there" },
      ]),
    ).toBe("hello there");
  });

  it("applies multiple edits without offset drift", () => {
    const edits = [
      { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1, newText: "X" },
      { startLine: 0, startCharacter: 4, endLine: 0, endCharacter: 5, newText: "Z" },
    ];
    expect(applyTextEdits("a b c", edits)).toBe("X b Z");
  });

  it("handles multi-line ranges", () => {
    expect(
      applyTextEdits("line1\nline2\nline3", [
        { startLine: 0, startCharacter: 0, endLine: 1, endCharacter: 5, newText: "X" },
      ]),
    ).toBe("X\nline3");
  });
});
