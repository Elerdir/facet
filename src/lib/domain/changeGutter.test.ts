import { describe, it, expect } from "vitest";
import { changeMarkers } from "./changeGutter";

describe("changeMarkers", () => {
  it("returns no markers when content matches HEAD", () => {
    expect(changeMarkers("a\nb\nc", "a\nb\nc").size).toBe(0);
  });

  it("marks pure additions", () => {
    // Insert a new line between b and c.
    const m = changeMarkers("a\nb\nc", "a\nb\nNEW\nc");
    expect(m.get(3)).toBe("added");
    expect(m.size).toBe(1);
  });

  it("marks modified lines (a line was changed in place)", () => {
    const m = changeMarkers("a\nb\nc", "a\nB!\nc");
    expect(m.get(2)).toBe("modified");
  });

  it("marks a removal on the line above the deletion", () => {
    const m = changeMarkers("a\nb\nc", "a\nc");
    expect(m.get(1)).toBe("removed");
  });

  it("treats a file absent from HEAD as all added", () => {
    const m = changeMarkers("", "x\ny");
    expect(m.get(1)).toBe("added");
    expect(m.get(2)).toBe("added");
    expect(changeMarkers("", "").size).toBe(0);
  });
});
