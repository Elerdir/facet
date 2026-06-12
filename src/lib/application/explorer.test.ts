import { describe, it, expect } from "vitest";
import { ExplorerStore } from "./explorer.svelte";
import { FakeFileSystem } from "./testing/fakes";

describe("ExplorerStore", () => {
  it("loads and sorts the root folder (directories first)", async () => {
    const fs = new FakeFileSystem();
    fs.dirs.set("/proj", [
      { name: "README.md", path: "/proj/README.md", isDir: false },
      { name: "src", path: "/proj/src", isDir: true },
    ]);
    const store = new ExplorerStore(fs);
    await store.openFolder("/proj");
    expect(store.rootName).toBe("proj");
    expect(store.nodes.map((n) => n.entry.name)).toEqual(["src", "README.md"]);
  });

  it("lazily loads children when a directory is expanded", async () => {
    const fs = new FakeFileSystem();
    fs.dirs.set("/proj", [{ name: "src", path: "/proj/src", isDir: true }]);
    fs.dirs.set("/proj/src", [
      { name: "main.rs", path: "/proj/src/main.rs", isDir: false },
    ]);
    const store = new ExplorerStore(fs);
    await store.openFolder("/proj");

    const dir = store.nodes[0];
    expect(dir.children).toBeNull();
    await store.toggle(dir);
    expect(dir.expanded).toBe(true);
    expect(dir.children?.map((c) => c.entry.name)).toEqual(["main.rs"]);
  });

  it("collapses without reloading already-loaded children", async () => {
    const fs = new FakeFileSystem();
    fs.dirs.set("/proj", [{ name: "src", path: "/proj/src", isDir: true }]);
    fs.dirs.set("/proj/src", []);
    const store = new ExplorerStore(fs);
    await store.openFolder("/proj");

    const dir = store.nodes[0];
    await store.toggle(dir); // expand (loads)
    await store.toggle(dir); // collapse
    expect(dir.expanded).toBe(false);
    expect(dir.children).not.toBeNull(); // cached
  });
});
