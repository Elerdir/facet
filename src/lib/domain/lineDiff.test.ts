import { describe, it, expect } from "vitest";
import { lineDiff } from "./lineDiff";

describe("lineDiff", () => {
  it("marks an unchanged document as all same", () => {
    const ops = lineDiff("a\nb\nc", "a\nb\nc");
    expect(ops.every((o) => o.kind === "same")).toBe(true);
    expect(ops).toHaveLength(3);
  });

  it("detects a replaced line as del + add", () => {
    const ops = lineDiff("a\nb\nc", "a\nB\nc");
    expect(ops.map((o) => `${o.kind}:${o.text}`)).toEqual([
      "same:a",
      "del:b",
      "add:B",
      "same:c",
    ]);
  });

  it("handles pure insertion and deletion", () => {
    expect(lineDiff("a\nc", "a\nb\nc").filter((o) => o.kind === "add")).toEqual([
      { kind: "add", text: "b" },
    ]);
    expect(lineDiff("a\nb\nc", "a\nc").filter((o) => o.kind === "del")).toEqual([
      { kind: "del", text: "b" },
    ]);
  });

  it("keeps the common subsequence stable", () => {
    const ops = lineDiff("one\ntwo\nthree", "one\ntwo\nTHREE\nfour");
    const kept = ops.filter((o) => o.kind === "same").map((o) => o.text);
    expect(kept).toEqual(["one", "two"]);
    expect(ops.some((o) => o.kind === "add" && o.text === "four")).toBe(true);
  });
});
