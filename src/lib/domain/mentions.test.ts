import { describe, it, expect } from "vitest";
import { extractMentions } from "./mentions";

describe("extractMentions", () => {
  it("extracts file paths after @", () => {
    expect(extractMentions("oprav @src/foo.ts a @README.md prosím")).toEqual([
      "src/foo.ts",
      "README.md",
    ]);
  });

  it("dedupes and trims trailing punctuation", () => {
    expect(extractMentions("@a/b.ts, @a/b.ts.")).toEqual(["a/b.ts"]);
  });

  it("returns [] when there are no mentions", () => {
    expect(extractMentions("jen normální text")).toEqual([]);
  });
});
