import { describe, it, expect } from "vitest";
import { CompareStore } from "./compare.svelte";
import { FakeDiff } from "./testing/fakes";

describe("CompareStore", () => {
  it("is inactive until a comparison runs", () => {
    const store = new CompareStore(new FakeDiff());
    expect(store.active).toBe(false);
  });

  it("runs a comparison and stores the rows", async () => {
    const diff = new FakeDiff();
    diff.result = [
      { kind: "equal", leftLine: 1, left: "a", rightLine: 1, right: "a" },
    ];
    const store = new CompareStore(diff);
    await store.run("/l", "/r");

    expect(store.active).toBe(true);
    expect(store.leftPath).toBe("/l");
    expect(store.rightPath).toBe("/r");
    expect(store.rows).toHaveLength(1);
    expect(diff.calls).toEqual([["/l", "/r"]]);
  });

  it("captures errors and clears rows", async () => {
    const diff = new FakeDiff();
    diff.diffFiles = async () => {
      throw new Error("boom");
    };
    const store = new CompareStore(diff);
    await store.run("/l", "/r");

    expect(store.error).toContain("boom");
    expect(store.rows).toHaveLength(0);
  });

  it("clears back to inactive", async () => {
    const store = new CompareStore(new FakeDiff());
    await store.run("/l", "/r");
    store.clear();
    expect(store.active).toBe(false);
    expect(store.rows).toHaveLength(0);
  });
});
