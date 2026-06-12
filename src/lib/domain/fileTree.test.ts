import { describe, it, expect } from "vitest";
import { sortEntries, type TreeEntry } from "./fileTree";

function entry(name: string, isDir: boolean): TreeEntry {
  return { name, path: `/root/${name}`, isDir };
}

describe("fileTree.sortEntries", () => {
  it("places directories before files", () => {
    const sorted = sortEntries([
      entry("b.txt", false),
      entry("a-dir", true),
      entry("a.txt", false),
      entry("z-dir", true),
    ]);
    expect(sorted.map((e) => e.name)).toEqual([
      "a-dir",
      "z-dir",
      "a.txt",
      "b.txt",
    ]);
  });

  it("sorts case-insensitively", () => {
    const sorted = sortEntries([
      entry("Beta.txt", false),
      entry("alpha.txt", false),
    ]);
    expect(sorted.map((e) => e.name)).toEqual(["alpha.txt", "Beta.txt"]);
  });

  it("sorts numbers naturally", () => {
    const sorted = sortEntries([
      entry("file10.txt", false),
      entry("file2.txt", false),
    ]);
    expect(sorted.map((e) => e.name)).toEqual(["file2.txt", "file10.txt"]);
  });

  it("does not mutate the input array", () => {
    const input = [entry("b", false), entry("a", false)];
    const copy = [...input];
    sortEntries(input);
    expect(input).toEqual(copy);
  });
});
