import { describe, it, expect } from "vitest";
import { LayoutStore } from "./layoutStore.svelte";
import { createIdGen } from "../domain/ids";

const setup = () => new LayoutStore(createIdGen("pane"));

describe("LayoutStore", () => {
  it("starts with a single empty active leaf", () => {
    const s = setup();
    expect(s.activeLeaf.tabs).toEqual([]);
    expect(s.activeTabId).toBeNull();
  });

  it("opens buffers in the active leaf", () => {
    const s = setup();
    s.openInActiveLeaf("a");
    s.openInActiveLeaf("b");
    expect(s.activeLeaf.tabs).toEqual(["a", "b"]);
    expect(s.activeTabId).toBe("b");
  });

  it("splits the active leaf and carries the active tab into the new pane", () => {
    const s = setup();
    s.openInActiveLeaf("a");
    const firstLeafId = s.activeLeafId;
    s.split(firstLeafId, "row");
    expect(s.activeLeafId).not.toBe(firstLeafId);
    expect(s.activeLeaf.tabs).toEqual(["a"]);
    expect(s.tabRefCount("a")).toBe(2);
  });

  it("removes a non-last pane when its last tab is closed", () => {
    const s = setup();
    s.openInActiveLeaf("a");
    const first = s.activeLeafId;
    s.split(first, "row");
    const second = s.activeLeafId;
    s.closeTab(second, "a");
    expect(s.activeLeafId).toBe(first);
    expect(s.tabRefCount("a")).toBe(1);
  });

  it("keeps the only pane (now empty) when its last tab is closed", () => {
    const s = setup();
    s.openInActiveLeaf("a");
    const id = s.activeLeafId;
    s.closeTab(id, "a");
    expect(s.activeLeaf.tabs).toEqual([]);
    expect(s.activeLeafId).toBe(id);
  });

  it("activates a tab and focuses its pane", () => {
    const s = setup();
    s.openInActiveLeaf("a");
    s.openInActiveLeaf("b");
    const leafId = s.activeLeafId;
    s.setActiveTab(leafId, "a");
    expect(s.activeTabId).toBe("a");
  });

  it("splits into a preview pane that shares the source buffer", () => {
    const s = setup();
    s.openInActiveLeaf("a");
    const first = s.activeLeafId;
    s.split(first, "row", "preview");
    expect(s.activeLeafId).not.toBe(first);
    expect(s.activeLeaf.view).toBe("preview");
    expect(s.activeLeaf.tabs).toEqual(["a"]);
    expect(s.tabRefCount("a")).toBe(2);
  });

  it("toggles a pane between editor and preview", () => {
    const s = setup();
    const id = s.activeLeafId;
    s.setView(id, "preview");
    expect(s.activeLeaf.view).toBe("preview");
    s.setView(id, "editor");
    expect(s.activeLeaf.view).toBe("editor");
  });
});
