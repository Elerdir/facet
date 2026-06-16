import { basename } from "../domain/paths";
import { sortEntries, type TreeEntry } from "../domain/fileTree";
import type { FileSystemPort } from "../ports/fileSystem";

/** A node in the explorer tree: an entry plus its reactive UI state. */
export interface TreeNode {
  entry: TreeEntry;
  /** Loaded children, or null while not yet loaded (lazy). */
  children: TreeNode[] | null;
  expanded: boolean;
  loading: boolean;
}

/** One workspace root folder (the explorer can hold several). */
export interface RootFolder {
  path: string;
  name: string;
  nodes: TreeNode[];
  expanded: boolean;
}

/**
 * Reactive multi-root file explorer. Holds one or more workspace folders, each
 * lazily loaded one directory level at a time. `rootPath`/`rootName`/`nodes`
 * expose the primary (first) root so single-root consumers keep working.
 */
export class ExplorerStore {
  roots = $state<RootFolder[]>([]);

  #fs: FileSystemPort;

  constructor(fs: FileSystemPort) {
    this.#fs = fs;
  }

  /** Primary (first) workspace root, for single-root consumers. */
  get rootPath(): string | null {
    return this.roots[0]?.path ?? null;
  }

  get rootName(): string {
    return this.roots[0]?.name ?? "";
  }

  /** Top-level nodes of the primary root (legacy single-root accessor). */
  get nodes(): TreeNode[] {
    return this.roots[0]?.nodes ?? [];
  }

  /** The workspace root that contains a path (longest match), or null. */
  rootForPath(path: string): string | null {
    let best: string | null = null;
    for (const r of this.roots) {
      const inside = path === r.path || path.startsWith(r.path + "/") || path.startsWith(r.path + "\\");
      if (inside && (best === null || r.path.length > best.length)) best = r.path;
    }
    return best;
  }

  /** Replace the workspace with a single folder. */
  async openFolder(path: string): Promise<void> {
    this.roots = [{ path, name: basename(path), nodes: await this.#load(path), expanded: true }];
  }

  /** Add another folder to the workspace (no-op if already present). */
  async addFolder(path: string): Promise<void> {
    if (this.roots.some((r) => r.path === path)) return;
    const root: RootFolder = { path, name: basename(path), nodes: await this.#load(path), expanded: true };
    this.roots = [...this.roots, root];
  }

  /** Remove a folder from the workspace. */
  removeFolder(path: string): void {
    this.roots = this.roots.filter((r) => r.path !== path);
  }

  async toggle(node: TreeNode): Promise<void> {
    if (!node.entry.isDir) return;
    node.expanded = !node.expanded;
    if (node.expanded && node.children === null) {
      node.loading = true;
      try {
        node.children = await this.#load(node.entry.path);
      } finally {
        node.loading = false;
      }
    }
  }

  toggleRoot(root: RootFolder): void {
    root.expanded = !root.expanded;
  }

  async refresh(): Promise<void> {
    for (const root of this.roots) root.nodes = await this.#load(root.path);
  }

  /** Reload one directory's children in place (or its root), preserving the rest. */
  async reloadPath(dirPath: string | null): Promise<void> {
    if (!dirPath) {
      await this.refresh();
      return;
    }
    const root = this.roots.find((r) => r.path === dirPath);
    if (root) {
      root.nodes = await this.#load(dirPath);
      root.expanded = true;
      return;
    }
    const node = this.#findInAll(dirPath);
    if (node && node.entry.isDir) {
      node.children = await this.#load(dirPath);
      node.expanded = true;
    } else {
      await this.refresh();
    }
  }

  #findInAll(path: string): TreeNode | null {
    for (const root of this.roots) {
      const hit = this.#find(root.nodes, path);
      if (hit) return hit;
    }
    return null;
  }

  #find(nodes: TreeNode[], path: string): TreeNode | null {
    for (const n of nodes) {
      if (n.entry.path === path) return n;
      if (n.children) {
        const hit = this.#find(n.children, path);
        if (hit) return hit;
      }
    }
    return null;
  }

  async #load(path: string): Promise<TreeNode[]> {
    const entries = sortEntries(await this.#fs.readDir(path));
    return entries.map((entry) => ({
      entry,
      children: null,
      expanded: false,
      loading: false,
    }));
  }
}
