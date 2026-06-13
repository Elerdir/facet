/**
 * Editor layout as an immutable binary split-tree.
 *
 * A leaf is an editor group ("pane") holding an ordered list of tab ids
 * (buffer ids) and which one is active. A split arranges two children either
 * side by side ("row") or stacked ("column"), with relative sizes.
 *
 * Every operation is a pure function returning a new tree, which makes the
 * layout fully unit-testable and trivial to drive from a Svelte `$state` root.
 */

export type Orientation = "row" | "column";

/** What a pane renders for its active buffer. Extensible (diff, …). */
export type ViewKind = "editor" | "preview" | "hex";

export interface PaneLeaf {
  kind: "leaf";
  id: string;
  /** Ordered buffer ids open in this pane. */
  tabs: string[];
  activeTab: string | null;
  /** How this pane displays its active buffer. */
  view: ViewKind;
}

export interface PaneSplit {
  kind: "split";
  id: string;
  orientation: Orientation;
  children: [LayoutNode, LayoutNode];
  /** Relative sizes of the two children; conventionally sums to 1. */
  sizes: [number, number];
}

export type LayoutNode = PaneLeaf | PaneSplit;

export function leaf(
  id: string,
  tabs: string[] = [],
  activeTab: string | null = null,
  view: ViewKind = "editor",
): PaneLeaf {
  return { kind: "leaf", id, tabs, activeTab, view };
}

export function isLeaf(node: LayoutNode): node is PaneLeaf {
  return node.kind === "leaf";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function findLeaf(node: LayoutNode, id: string): PaneLeaf | null {
  if (isLeaf(node)) return node.id === id ? node : null;
  return findLeaf(node.children[0], id) ?? findLeaf(node.children[1], id);
}

export function allLeaves(node: LayoutNode): PaneLeaf[] {
  if (isLeaf(node)) return [node];
  return [...allLeaves(node.children[0]), ...allLeaves(node.children[1])];
}

export function firstLeaf(node: LayoutNode): PaneLeaf {
  return isLeaf(node) ? node : firstLeaf(node.children[0]);
}

/** How many panes currently show the given tab/buffer. */
export function tabRefCount(node: LayoutNode, tabId: string): number {
  return allLeaves(node).reduce(
    (acc, l) => acc + (l.tabs.includes(tabId) ? 1 : 0),
    0,
  );
}

// ---------------------------------------------------------------------------
// Leaf-level (pure) tab operations
// ---------------------------------------------------------------------------

export function addTab(l: PaneLeaf, tabId: string): PaneLeaf {
  if (l.tabs.includes(tabId)) return { ...l, activeTab: tabId };
  return { ...l, tabs: [...l.tabs, tabId], activeTab: tabId };
}

export function removeTab(l: PaneLeaf, tabId: string): PaneLeaf {
  const idx = l.tabs.indexOf(tabId);
  if (idx < 0) return l;
  const tabs = l.tabs.filter((t) => t !== tabId);
  let activeTab = l.activeTab;
  if (activeTab === tabId) {
    // Activate the neighbour that takes the closed tab's place.
    activeTab = tabs[idx] ?? tabs[idx - 1] ?? null;
  }
  return { ...l, tabs, activeTab };
}

export function setActiveTab(l: PaneLeaf, tabId: string): PaneLeaf {
  return l.tabs.includes(tabId) ? { ...l, activeTab: tabId } : l;
}

export function setView(l: PaneLeaf, view: ViewKind): PaneLeaf {
  return l.view === view ? l : { ...l, view };
}

/** Insert a tab at an index (end when omitted) and activate it. */
export function insertTab(l: PaneLeaf, tabId: string, index?: number): PaneLeaf {
  if (l.tabs.includes(tabId)) return setActiveTab(l, tabId);
  const tabs = [...l.tabs];
  const at = index === undefined ? tabs.length : Math.max(0, Math.min(index, tabs.length));
  tabs.splice(at, 0, tabId);
  return { ...l, tabs, activeTab: tabId };
}

// ---------------------------------------------------------------------------
// Tree-level (pure) operations
// ---------------------------------------------------------------------------

/** Replace a leaf with an arbitrary node produced by `fn`. */
export function replaceLeaf(
  node: LayoutNode,
  id: string,
  fn: (l: PaneLeaf) => LayoutNode,
): LayoutNode {
  if (isLeaf(node)) return node.id === id ? fn(node) : node;
  const c0 = replaceLeaf(node.children[0], id, fn);
  const c1 = replaceLeaf(node.children[1], id, fn);
  if (c0 === node.children[0] && c1 === node.children[1]) return node;
  return { ...node, children: [c0, c1] };
}

/** Transform a leaf in place (it stays a leaf). */
export function updateLeaf(
  node: LayoutNode,
  id: string,
  fn: (l: PaneLeaf) => PaneLeaf,
): LayoutNode {
  return replaceLeaf(node, id, fn);
}

/** Split a leaf, inserting `newLeaf` beside it under a new split node. */
export function splitLeaf(
  root: LayoutNode,
  leafId: string,
  orientation: Orientation,
  newLeaf: PaneLeaf,
  splitId: string,
): LayoutNode {
  return replaceLeaf(root, leafId, (l) => ({
    kind: "split",
    id: splitId,
    orientation,
    children: [l, newLeaf],
    sizes: [0.5, 0.5],
  }));
}

/**
 * Remove a leaf. When a split loses one child, it collapses to the surviving
 * child. Returns null only if the whole tree was the removed leaf.
 */
export function removeLeaf(node: LayoutNode, id: string): LayoutNode | null {
  if (isLeaf(node)) return node.id === id ? null : node;
  const c0 = removeLeaf(node.children[0], id);
  const c1 = removeLeaf(node.children[1], id);
  if (c0 === null) return c1;
  if (c1 === null) return c0;
  if (c0 === node.children[0] && c1 === node.children[1]) return node;
  return { ...node, children: [c0, c1] };
}

/** Update a split node's relative sizes. */
export function setSplitSizes(
  node: LayoutNode,
  splitId: string,
  sizes: [number, number],
): LayoutNode {
  if (isLeaf(node)) return node;
  if (node.id === splitId) return { ...node, sizes };
  const c0 = setSplitSizes(node.children[0], splitId, sizes);
  const c1 = setSplitSizes(node.children[1], splitId, sizes);
  if (c0 === node.children[0] && c1 === node.children[1]) return node;
  return { ...node, children: [c0, c1] };
}
