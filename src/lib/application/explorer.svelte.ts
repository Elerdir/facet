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

/**
 * Reactive file-explorer state. Directories are loaded lazily one level at a
 * time through the FileSystemPort.
 */
export class ExplorerStore {
  rootPath = $state<string | null>(null);
  rootName = $state<string>("");
  nodes = $state<TreeNode[]>([]);

  #fs: FileSystemPort;

  constructor(fs: FileSystemPort) {
    this.#fs = fs;
  }

  async openFolder(path: string): Promise<void> {
    this.rootPath = path;
    this.rootName = basename(path);
    this.nodes = await this.#load(path);
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

  async refresh(): Promise<void> {
    if (this.rootPath) this.nodes = await this.#load(this.rootPath);
  }

  /** Reload one directory's children in place (preserving the rest of the
   * tree's expansion), or the whole root when the path is the root/unloaded. */
  async reloadPath(dirPath: string | null): Promise<void> {
    if (!dirPath || dirPath === this.rootPath) {
      await this.refresh();
      return;
    }
    const node = this.#find(this.nodes, dirPath);
    if (node && node.entry.isDir) {
      node.children = await this.#load(dirPath);
      node.expanded = true;
    } else {
      await this.refresh();
    }
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
