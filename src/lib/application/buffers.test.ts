import { describe, it, expect } from "vitest";
import { BufferStore } from "./buffers.svelte";
import { createIdGen } from "../domain/ids";
import { FakeFileSystem, FakeDialog } from "./testing/fakes";

function setup() {
  const fs = new FakeFileSystem();
  const dialog = new FakeDialog();
  const store = new BufferStore(fs, dialog, createIdGen("buf"));
  return { fs, dialog, store };
}

describe("BufferStore", () => {
  it("creates sequentially-named untitled buffers", () => {
    const { store } = setup();
    const a = store.createUntitled();
    const b = store.createUntitled();
    expect(a.name).toBe("bez názvu 1");
    expect(b.name).toBe("bez názvu 2");
    expect(store.items).toHaveLength(2);
  });

  it("opens a file and derives its name from the path", async () => {
    const { fs, store } = setup();
    fs.files.set("/proj/main.rs", "fn main() {}");
    const buf = await store.openPath("/proj/main.rs");
    expect(buf.name).toBe("main.rs");
    expect(buf.content).toBe("fn main() {}");
    expect(store.isDirty(buf)).toBe(false);
  });

  it("dedupes by path instead of opening the same file twice", async () => {
    const { fs, store } = setup();
    fs.files.set("/a.txt", "x");
    const first = await store.openPath("/a.txt");
    const second = await store.openPath("/a.txt");
    expect(second).toBe(first);
    expect(store.items).toHaveLength(1);
  });

  it("becomes dirty after editing and clean again after saving", async () => {
    const { fs, store } = setup();
    fs.files.set("/a.txt", "x");
    const buf = await store.openPath("/a.txt");
    store.setContent(buf.id, "x changed");
    expect(store.isDirty(buf)).toBe(true);

    const ok = await store.save(buf.id);
    expect(ok).toBe(true);
    expect(store.isDirty(buf)).toBe(false);
    expect(fs.files.get("/a.txt")).toBe("x changed");
  });

  it("prompts for a path when saving an untitled buffer", async () => {
    const { fs, dialog, store } = setup();
    const buf = store.createUntitled();
    store.setContent(buf.id, "hello");
    dialog.saveFileResult = "/new.txt";

    const ok = await store.save(buf.id);
    expect(ok).toBe(true);
    expect(buf.path).toBe("/new.txt");
    expect(buf.name).toBe("new.txt");
    expect(fs.files.get("/new.txt")).toBe("hello");
  });

  it("cancels the save when no path is chosen", async () => {
    const { dialog, store } = setup();
    const buf = store.createUntitled();
    dialog.saveFileResult = null;
    const ok = await store.save(buf.id);
    expect(ok).toBe(false);
    expect(buf.path).toBeNull();
  });

  it("closes a buffer", () => {
    const { store } = setup();
    const buf = store.createUntitled();
    store.close(buf.id);
    expect(store.items).toHaveLength(0);
  });
});
