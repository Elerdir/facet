import { describe, it, expect } from "vitest";
import { groupChanges, statusBadge, type FileStatus } from "./vcs";

const file = (path: string, staged: boolean): FileStatus => ({
  path,
  status: "modified",
  staged,
});

describe("groupChanges", () => {
  it("splits files into staged and unstaged", () => {
    const grouped = groupChanges([
      file("a", true),
      file("b", false),
      file("c", true),
    ]);
    expect(grouped.staged.map((f) => f.path)).toEqual(["a", "c"]);
    expect(grouped.unstaged.map((f) => f.path)).toEqual(["b"]);
  });

  it("handles an empty list", () => {
    expect(groupChanges([])).toEqual({ staged: [], unstaged: [] });
  });
});

describe("statusBadge", () => {
  it("maps kinds to single letters", () => {
    expect(statusBadge("added")).toBe("A");
    expect(statusBadge("deleted")).toBe("D");
    expect(statusBadge("untracked")).toBe("U");
    expect(statusBadge("renamed")).toBe("R");
    expect(statusBadge("modified")).toBe("M");
  });
});
