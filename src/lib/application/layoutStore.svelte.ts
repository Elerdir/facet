import { createIdGen } from "../domain/ids";
import * as L from "../domain/layout";

/**
 * Reactive owner of the editor layout tree. Holds the `$state` root and the
 * active leaf; all mutations delegate to the pure operations in `domain/layout`.
 */
export class LayoutStore {
  root = $state<L.LayoutNode>(L.leaf("pane-init"));
  activeLeafId = $state<string>("pane-init");
  /** A pending "scroll to line" request for a buffer (from search/quick-open). */
  revealTarget = $state<{ bufferId: string; line: number } | null>(null);

  #nextId: () => string;

  constructor(idGen: () => string = createIdGen("pane")) {
    this.#nextId = idGen;
    const first = L.leaf(this.#nextId());
    this.root = first;
    this.activeLeafId = first.id;
  }

  get activeLeaf(): L.PaneLeaf {
    return L.findLeaf(this.root, this.activeLeafId) ?? L.firstLeaf(this.root);
  }

  get activeTabId(): string | null {
    return this.activeLeaf.activeTab;
  }

  setActiveLeaf(id: string): void {
    if (L.findLeaf(this.root, id)) this.activeLeafId = id;
  }

  setActiveTab(leafId: string, tabId: string): void {
    this.root = L.updateLeaf(this.root, leafId, (l) => L.setActiveTab(l, tabId));
    this.activeLeafId = leafId;
  }

  openInActiveLeaf(tabId: string): void {
    this.root = L.updateLeaf(this.root, this.activeLeafId, (l) =>
      L.addTab(l, tabId),
    );
  }

  closeTab(leafId: string, tabId: string): void {
    if (this.isPinned(tabId)) this.pinned = this.pinned.filter((x) => x !== tabId);
    let root = L.updateLeaf(this.root, leafId, (l) => L.removeTab(l, tabId));
    const target = L.findLeaf(root, leafId);
    if (target && target.tabs.length === 0 && L.allLeaves(root).length > 1) {
      root = L.removeLeaf(root, leafId)!;
      if (this.activeLeafId === leafId) {
        this.activeLeafId = L.firstLeaf(root).id;
      }
    }
    this.root = root;
  }

  split(
    leafId: string,
    orientation: L.Orientation,
    view: L.ViewKind = "editor",
  ): void {
    const src = L.findLeaf(this.root, leafId);
    if (!src) return;
    const newLeaf = L.leaf(
      this.#nextId(),
      src.activeTab ? [src.activeTab] : [],
      src.activeTab,
      view,
    );
    this.root = L.splitLeaf(
      this.root,
      leafId,
      orientation,
      newLeaf,
      this.#nextId(),
    );
    this.activeLeafId = newLeaf.id;
  }

  setView(leafId: string, view: L.ViewKind): void {
    this.root = L.updateLeaf(this.root, leafId, (l) => L.setView(l, view));
  }

  setSizes(splitId: string, sizes: [number, number]): void {
    this.root = L.setSplitSizes(this.root, splitId, sizes);
  }

  tabRefCount(tabId: string): number {
    return L.tabRefCount(this.root, tabId);
  }

  /** Remove a tab from every pane that shows it (e.g. its file was deleted). */
  closeTabEverywhere(tabId: string): void {
    for (const leaf of L.allLeaves(this.root)) {
      if (leaf.tabs.includes(tabId)) this.closeTab(leaf.id, tabId);
    }
  }

  /** Pinned tab ids (rendered first; a visual "keep open" marker). */
  pinned = $state<string[]>([]);

  isPinned(tabId: string): boolean {
    return this.pinned.includes(tabId);
  }

  togglePin(tabId: string): void {
    this.pinned = this.isPinned(tabId)
      ? this.pinned.filter((x) => x !== tabId)
      : [...this.pinned, tabId];
  }

  /** Move a tab between panes (or reorder within one); drag & drop. */
  moveTab(fromLeafId: string, tabId: string, toLeafId: string, toIndex?: number): void {
    const source = L.findLeaf(this.root, fromLeafId);
    if (!source || !source.tabs.includes(tabId)) return;

    let index = toIndex;
    if (fromLeafId === toLeafId && index !== undefined) {
      // Removing the tab first shifts later indices left by one.
      const original = source.tabs.indexOf(tabId);
      if (index > original) index -= 1;
    }

    let root = L.updateLeaf(this.root, fromLeafId, (l) => L.removeTab(l, tabId));
    root = L.updateLeaf(root, toLeafId, (l) => L.insertTab(l, tabId, index));

    // Collapse the source pane when the move emptied it.
    const src = L.findLeaf(root, fromLeafId);
    if (src && src.tabs.length === 0 && L.allLeaves(root).length > 1) {
      root = L.removeLeaf(root, fromLeafId)!;
    }

    this.root = root;
    this.activeLeafId = L.findLeaf(root, toLeafId) ? toLeafId : L.firstLeaf(root).id;
  }

  requestReveal(bufferId: string, line: number): void {
    this.revealTarget = { bufferId, line };
  }

  consumeReveal(): void {
    this.revealTarget = null;
  }
}
