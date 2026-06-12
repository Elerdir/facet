import { describe, it, expect } from "vitest";
import {
  leaf,
  isLeaf,
  findLeaf,
  allLeaves,
  firstLeaf,
  tabRefCount,
  addTab,
  removeTab,
  setActiveTab,
  setView,
  splitLeaf,
  removeLeaf,
  setSplitSizes,
  updateLeaf,
  type LayoutNode,
  type PaneSplit,
} from "./layout";

describe("layout leaf tab operations", () => {
  it("addTab appends and activates a new tab", () => {
    const l = addTab(leaf("p1", ["a"], "a"), "b");
    expect(l.tabs).toEqual(["a", "b"]);
    expect(l.activeTab).toBe("b");
  });

  it("addTab only re-activates an already open tab", () => {
    const l = addTab(leaf("p1", ["a", "b"], "b"), "a");
    expect(l.tabs).toEqual(["a", "b"]);
    expect(l.activeTab).toBe("a");
  });

  it("removeTab activates the following neighbour", () => {
    const l = removeTab(leaf("p1", ["a", "b", "c"], "b"), "b");
    expect(l.tabs).toEqual(["a", "c"]);
    expect(l.activeTab).toBe("c");
  });

  it("removeTab falls back to the previous neighbour at the end", () => {
    const l = removeTab(leaf("p1", ["a", "b", "c"], "c"), "c");
    expect(l.tabs).toEqual(["a", "b"]);
    expect(l.activeTab).toBe("b");
  });

  it("removeTab keeps active untouched when removing a non-active tab", () => {
    const l = removeTab(leaf("p1", ["a", "b", "c"], "a"), "c");
    expect(l.activeTab).toBe("a");
  });

  it("removeTab clears active when the last tab is removed", () => {
    const l = removeTab(leaf("p1", ["a"], "a"), "a");
    expect(l.tabs).toEqual([]);
    expect(l.activeTab).toBeNull();
  });

  it("setActiveTab ignores tabs not in the pane", () => {
    const base = leaf("p1", ["a"], "a");
    expect(setActiveTab(base, "z")).toBe(base);
  });

  it("a leaf defaults to the editor view", () => {
    expect(leaf("p1").view).toBe("editor");
  });

  it("setView switches the view kind", () => {
    expect(setView(leaf("p1"), "preview").view).toBe("preview");
  });

  it("setView returns the same leaf when the view is unchanged", () => {
    const base = leaf("p1");
    expect(setView(base, "editor")).toBe(base);
  });
});

describe("layout tree operations", () => {
  const buildSplit = (): LayoutNode =>
    splitLeaf(leaf("p1", ["a"], "a"), "p1", "row", leaf("p2", ["b"], "b"), "s1");

  it("splitLeaf wraps the target leaf in a split with both panes", () => {
    const root = buildSplit() as PaneSplit;
    expect(root.kind).toBe("split");
    expect(root.orientation).toBe("row");
    expect(allLeaves(root).map((l) => l.id)).toEqual(["p1", "p2"]);
    expect(root.sizes).toEqual([0.5, 0.5]);
  });

  it("findLeaf locates a nested leaf and returns null when absent", () => {
    const root = buildSplit();
    expect(findLeaf(root, "p2")?.id).toBe("p2");
    expect(findLeaf(root, "missing")).toBeNull();
  });

  it("firstLeaf returns the left-most leaf", () => {
    expect(firstLeaf(buildSplit()).id).toBe("p1");
  });

  it("updateLeaf only changes the targeted leaf", () => {
    const root = updateLeaf(buildSplit(), "p2", (l) => addTab(l, "c"));
    expect(findLeaf(root, "p1")!.tabs).toEqual(["a"]);
    expect(findLeaf(root, "p2")!.tabs).toEqual(["b", "c"]);
  });

  it("removeLeaf collapses the split to the surviving sibling", () => {
    const root = removeLeaf(buildSplit(), "p2");
    expect(root).not.toBeNull();
    expect(isLeaf(root!)).toBe(true);
    expect((root as ReturnType<typeof leaf>).id).toBe("p1");
  });

  it("removeLeaf returns null when removing the only leaf", () => {
    expect(removeLeaf(leaf("solo"), "solo")).toBeNull();
  });

  it("setSplitSizes updates only the matching split", () => {
    const root = setSplitSizes(buildSplit(), "s1", [0.3, 0.7]) as PaneSplit;
    expect(root.sizes).toEqual([0.3, 0.7]);
  });

  it("tabRefCount counts panes showing a buffer across the tree", () => {
    // Both panes show buffer "a".
    const root = splitLeaf(
      leaf("p1", ["a"], "a"),
      "p1",
      "row",
      leaf("p2", ["a"], "a"),
      "s1",
    );
    expect(tabRefCount(root, "a")).toBe(2);
    expect(tabRefCount(root, "b")).toBe(0);
  });

  it("treats trees as immutable (original untouched after a split)", () => {
    const original = leaf("p1", ["a"], "a");
    splitLeaf(original, "p1", "row", leaf("p2"), "s1");
    expect(original.tabs).toEqual(["a"]);
    expect(isLeaf(original)).toBe(true);
  });
});
