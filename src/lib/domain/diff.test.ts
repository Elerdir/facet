import { describe, it, expect } from "vitest";
import { inlineDiff } from "./diff";

describe("inlineDiff", () => {
  it("finds the common prefix and suffix around a changed middle", () => {
    const a = "the cat sat";
    const b = "the dog sat";
    const { prefix, suffix } = inlineDiff(a, b);
    expect(a.slice(0, prefix)).toBe("the ");
    expect(a.slice(a.length - suffix)).toBe(" sat");
    expect(a.slice(prefix, a.length - suffix)).toBe("cat");
    expect(b.slice(prefix, b.length - suffix)).toBe("dog");
  });

  it("does not double-count for identical strings", () => {
    const r = inlineDiff("abc", "abc");
    expect(r.prefix).toBe(3);
    expect(r.suffix).toBe(0);
  });

  it("returns zero for completely different strings", () => {
    const r = inlineDiff("abc", "xyz");
    expect(r.prefix).toBe(0);
    expect(r.suffix).toBe(0);
  });

  it("handles a pure suffix change", () => {
    const a = "value1";
    const b = "value2";
    const { prefix } = inlineDiff(a, b);
    expect(a.slice(0, prefix)).toBe("value");
  });
});
