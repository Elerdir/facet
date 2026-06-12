import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyFilter } from "./fuzzy";

describe("fuzzyScore", () => {
  it("matches subsequences and rejects out-of-order queries", () => {
    expect(fuzzyScore("abc", "axbxc")).not.toBeNull();
    expect(fuzzyScore("abc", "acb")).toBeNull();
  });

  it("scores consecutive matches higher than scattered ones", () => {
    expect(fuzzyScore("ab", "ab")!).toBeGreaterThan(fuzzyScore("ab", "axxxb")!);
  });

  it("rewards matches at segment starts", () => {
    expect(fuzzyScore("m", "src/main.ts")!).toBeGreaterThan(
      fuzzyScore("m", "common")!,
    );
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("ABC", "aabbcc")).not.toBeNull();
  });
});

describe("fuzzyFilter", () => {
  it("returns all items (capped) for an empty query", () => {
    expect(fuzzyFilter("", ["a", "b", "c"], (x) => x, 2)).toEqual(["a", "b"]);
  });

  it("keeps matching items, best score first, and drops non-matches", () => {
    const items = ["main.ts", "margin.css", "readme.md"];
    const result = fuzzyFilter("main", items, (x) => x);
    expect(result[0]).toBe("main.ts"); // consecutive prefix match scores highest
    expect(result).not.toContain("readme.md");
  });

  it("respects the limit", () => {
    const items = ["aa", "ab", "ac", "ad"];
    expect(fuzzyFilter("a", items, (x) => x, 2)).toHaveLength(2);
  });
});
