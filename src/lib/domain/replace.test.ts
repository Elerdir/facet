import { describe, it, expect } from "vitest";
import { escapeRegExp, replaceAllLiteral } from "./replace";

describe("replaceAllLiteral", () => {
  it("replaces case-insensitively and counts", () => {
    const { result, count } = replaceAllLiteral("Foo foo FOO", "foo", "bar");
    expect(result).toBe("bar bar bar");
    expect(count).toBe(3);
  });

  it("treats the query literally (no regex metachars)", () => {
    const { result, count } = replaceAllLiteral("a.b a+b", "a.b", "X");
    expect(result).toBe("X a+b");
    expect(count).toBe(1);
  });

  it("inserts the replacement verbatim (no $ expansion)", () => {
    const { result } = replaceAllLiteral("hi", "hi", "$1&$&");
    expect(result).toBe("$1&$&");
  });

  it("returns the text unchanged for an empty query", () => {
    expect(replaceAllLiteral("abc", "", "x")).toEqual({ result: "abc", count: 0 });
  });

  it("escapeRegExp escapes metacharacters", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
  });
});
