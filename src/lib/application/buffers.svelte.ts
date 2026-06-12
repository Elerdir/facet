import { createIdGen } from "../domain/ids";
import { basename } from "../domain/paths";
import { isDirty, type Buffer } from "../domain/buffer";
import type { FileSystemPort } from "../ports/fileSystem";
import type { DialogPort } from "../ports/dialog";

/**
 * Owns the set of open buffers (shared across panes). Reactive via Svelte 5
 * runes; all I/O goes through injected ports so it is unit-testable with fakes.
 */
export class BufferStore {
  items = $state<Buffer[]>([]);

  #fs: FileSystemPort;
  #dialog: DialogPort;
  #nextId: () => string;
  #untitled = 0;

  constructor(
    fs: FileSystemPort,
    dialog: DialogPort,
    idGen: () => string = createIdGen("buf"),
  ) {
    this.#fs = fs;
    this.#dialog = dialog;
    this.#nextId = idGen;
  }

  get(id: string): Buffer | undefined {
    return this.items.find((b) => b.id === id);
  }

  isDirty(b: Buffer): boolean {
    return isDirty(b);
  }

  createUntitled(content = "", name?: string): Buffer {
    this.#untitled += 1;
    const buf: Buffer = {
      id: this.#nextId(),
      path: null,
      name: name ?? `bez názvu ${this.#untitled}`,
      content,
      savedContent: "",
      encoding: "UTF-8",
      size: 0,
      binary: false,
    };
    this.items.push(buf);
    // Return the reactive proxy from the state array, not the raw object —
    // Svelte 5 stores values in signals, so the pre-push reference is stale.
    return this.get(buf.id)!;
  }

  async openPath(path: string): Promise<Buffer> {
    const existing = this.items.find((b) => b.path === path);
    if (existing) return existing;

    // Inspect first so binary/huge files aren't blindly read as text.
    const info = await this.#fs.fileInfo(path);
    const content = info.binary ? "" : await this.#fs.readTextFile(path);
    const buf: Buffer = {
      id: this.#nextId(),
      path,
      name: basename(path),
      content,
      savedContent: content,
      encoding: info.encoding,
      size: info.size,
      binary: info.binary,
    };
    this.items.push(buf);
    return this.get(buf.id)!;
  }

  setContent(id: string, content: string): void {
    const b = this.get(id);
    if (b) b.content = content;
  }

  /** Save a buffer; returns false if the user cancelled the save dialog. */
  async save(id: string): Promise<boolean> {
    const b = this.get(id);
    if (!b) return false;
    let path = b.path;
    if (!path) {
      const selected = await this.#dialog.saveFile(b.name);
      if (!selected) return false;
      path = selected;
      b.path = path;
      b.name = basename(path);
    }
    await this.#fs.writeTextFile(path, b.content);
    b.savedContent = b.content;
    return true;
  }

  close(id: string): void {
    const idx = this.items.findIndex((b) => b.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  /**
   * Re-read a buffer from disk after an external change. Only clean buffers
   * reload — unsaved local edits always win. Returns true when reloaded.
   */
  async reloadFromDisk(id: string): Promise<boolean> {
    const b = this.get(id);
    if (!b || !b.path || isDirty(b)) return false;
    const content = await this.#fs.readTextFile(b.path);
    if (content === b.content) return false;
    b.content = content;
    b.savedContent = content;
    return true;
  }
}
