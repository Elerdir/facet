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

  requestReveal(bufferId: string, line: number): void {
    this.revealTarget = { bufferId, line };
  }

  consumeReveal(): void {
    this.revealTarget = null;
  }
}
