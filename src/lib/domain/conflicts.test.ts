import { describe, it, expect } from "vitest";
import { parseConflicts, resolveConflict, conflictAtLine } from "./conflicts";

const SAMPLE = [
  "line0",
  "<<<<<<< HEAD",
  "ours1",
  "ours2",
  "=======",
  "theirs1",
  ">>>>>>> branch",
  "line7",
].join("\n");

describe("parseConflicts", () => {
  it("parses a conflict block with both sides", () => {
    const c = parseConflicts(SAMPLE);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ startLine: 1, sepLine: 4, endLine: 6 });
    expect(c[0].ours).toEqual(["ours1", "ours2"]);
    expect(c[0].theirs).toEqual(["theirs1"]);
  });

  it("returns [] when there are no markers", () => {
    expect(parseConflicts("just\ntext")).toEqual([]);
  });
});

describe("resolveConflict", () => {
  const [c] = parseConflicts(SAMPLE);
  it("keeps current", () => {
    expect(resolveConflict(SAMPLE, c, "current")).toBe("line0\nours1\nours2\nline7");
  });
  it("keeps incoming", () => {
    expect(resolveConflict(SAMPLE, c, "incoming")).toBe("line0\ntheirs1\nline7");
  });
  it("keeps both", () => {
    expect(resolveConflict(SAMPLE, c, "both")).toBe("line0\nours1\nours2\ntheirs1\nline7");
  });
});

describe("conflictAtLine", () => {
  it("finds the conflict containing a line, else the first", () => {
    const c = parseConflicts(SAMPLE);
    expect(conflictAtLine(c, 3)).toBe(0);
    expect(conflictAtLine(c, 999)).toBe(0);
  });
});
