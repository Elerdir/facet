import { describe, it, expect } from "vitest";
import { HistoryStore } from "./history.svelte";
import { FakeHistory } from "./testing/fakes";

describe("HistoryStore", () => {
  it("appends and loads revisions newest-first", async () => {
    const port = new FakeHistory();
    const store = new HistoryStore(port);
    await store.append("/a", "v1");
    await store.append("/a", "v2");

    await store.load("/a");
    expect(store.currentPath).toBe("/a");
    expect(store.revisions).toHaveLength(2);
    expect(store.revisions[0].size).toBe(2); // "v2" newest first
  });

  it("fetches a revision's content", async () => {
    const port = new FakeHistory();
    const store = new HistoryStore(port);
    await store.append("/a", "hello");
    await store.load("/a");
    const id = store.revisions[0].id;
    expect(await store.get(id)).toBe("hello");
  });

  it("prunes revisions older than the retention window", async () => {
    const port = new FakeHistory(); // created_at starts at 1000
    const store = new HistoryStore(port, 7);
    await store.append("/a", "old");
    // 8 days after the revision timestamp -> outside the 7-day window
    const removed = await store.pruneOld(1000 + 8 * 24 * 60 * 60 * 1000);
    expect(removed).toBe(1);
  });

  it("clears the current view", async () => {
    const port = new FakeHistory();
    const store = new HistoryStore(port);
    await store.append("/a", "v1");
    await store.load("/a");
    store.clear();
    expect(store.currentPath).toBeNull();
    expect(store.revisions).toHaveLength(0);
  });
});
