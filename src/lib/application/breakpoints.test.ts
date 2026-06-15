import { describe, it, expect } from "vitest";
import { BreakpointStore } from "./breakpoints.svelte";

describe("BreakpointStore", () => {
  it("toggles breakpoints on and off", () => {
    const bp = new BreakpointStore();
    bp.toggle("/a.py", 3);
    bp.toggle("/a.py", 7);
    expect(bp.linesFor("/a.py")).toEqual([3, 7]);
    bp.toggle("/a.py", 3);
    expect(bp.linesFor("/a.py")).toEqual([7]);
  });

  it("groups breakpoints by file", () => {
    const bp = new BreakpointStore();
    bp.toggle("/a.py", 1);
    bp.toggle("/b.py", 2);
    bp.toggle("/a.py", 5);
    const byFile = bp.byFile().sort((x, y) => x.path.localeCompare(y.path));
    expect(byFile).toEqual([
      { path: "/a.py", lines: [1, 5] },
      { path: "/b.py", lines: [2] },
    ]);
  });

  it("clears all breakpoints", () => {
    const bp = new BreakpointStore();
    bp.toggle("/a.py", 1);
    bp.clear();
    expect(bp.list).toEqual([]);
  });
});
