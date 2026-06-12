import { BufferStore } from "./buffers.svelte";
import { LayoutStore } from "./layoutStore.svelte";
import { ExplorerStore } from "./explorer.svelte";
import { HistoryStore } from "./history.svelte";
import { CompareStore } from "./compare.svelte";
import { VcsStore } from "./vcs.svelte";
import { FormatterService } from "./formatter";
import { SettingsStore } from "./settings.svelte";
import { EditorStatusStore } from "./editorStatus.svelte";
import { RenameUiStore } from "./renameUi.svelte";
import { ReferencesUiStore } from "./referencesUi.svelte";
import { AiChatStore } from "./ai.svelte";
import { TextFormatStore } from "./textFormat.svelte";
import type { NewFileTemplate } from "../domain/newFileTemplates";
import { authHeaderFor, repoNameFromUrl } from "../domain/gitAuth";
import {
  buildCommitPrompt,
  buildSelectionPrompt,
  truncateContext,
  type SelectionAction,
} from "../domain/ai";
import type { AiPort } from "../ports/ai";
import { LspManager, type LspDiagnostic, type LspCompletionItem } from "./lsp.svelte";
import { serializeSession, parseSession } from "../config/session";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { isDirty, type Buffer } from "../domain/buffer";
import { dirname, normalize, pathFromFileUri, relativeTo } from "../domain/paths";
import { applyTextEdits } from "../lsp/edits";
import { serverForName, type ServerSpec } from "../lsp/servers";
import type { FileSystemPort } from "../ports/fileSystem";
import type { SearchMatch } from "../domain/search";
import type { LspTransport } from "../ports/lsp";
import type { WatcherPort } from "../ports/watcher";
import type { DialogPort } from "../ports/dialog";
import type { HistoryPort } from "../ports/history";
import type { DiffPort } from "../ports/diff";
import type { VcsPort } from "../ports/vcs";
import type { FormatterPort } from "../ports/formatter";
import type { FormatAction } from "../domain/formatting";
import type { Orientation } from "../domain/layout";

/**
 * Application facade: composes the buffer / layout / explorer stores and
 * exposes the high-level actions the UI invokes. Keeps cross-store invariants
 * in one place (e.g. closing a tab disposes its buffer when no pane shows it).
 */
export class Workspace {
  readonly buffers: BufferStore;
  readonly layout: LayoutStore;
  readonly explorer: ExplorerStore;
  readonly history: HistoryStore;
  readonly compare: CompareStore;
  readonly vcs: VcsStore;
  readonly formatter: FormatterService;
  readonly settings: SettingsStore;
  readonly editorStatus = new EditorStatusStore();
  readonly renameUi = new RenameUiStore();
  readonly referencesUi = new ReferencesUiStore();
  readonly lsp: LspManager;
  readonly ai: AiChatStore;
  readonly textFormat = new TextFormatStore();

  #fs: FileSystemPort;
  #dialog: DialogPort;
  #watcher: WatcherPort | null;
  #persistTimer: ReturnType<typeof setTimeout> | null = null;
  #fsChangeTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingFsChanges: string[] = [];

  constructor(
    fs: FileSystemPort,
    dialog: DialogPort,
    history: HistoryPort,
    diff: DiffPort,
    vcs: VcsPort,
    formatter: FormatterPort,
    lsp: LspTransport,
    ai: AiPort,
    watcher: WatcherPort | null = null,
  ) {
    this.buffers = new BufferStore(fs, dialog);
    this.layout = new LayoutStore();
    this.explorer = new ExplorerStore(fs);
    this.history = new HistoryStore(history);
    this.compare = new CompareStore(diff);
    this.vcs = new VcsStore(vcs, (remoteUrl) =>
      authHeaderFor(remoteUrl, this.settings.current),
    );
    this.formatter = new FormatterService(formatter);
    this.settings = new SettingsStore(fs);
    this.lsp = new LspManager(lsp);
    this.ai = new AiChatStore(ai, this.settings);
    this.#fs = fs;
    this.#dialog = dialog;
    this.#watcher = watcher;
    // Debounce watcher bursts (a single save often yields several events).
    watcher?.onChange((paths) => {
      this.#pendingFsChanges.push(...paths);
      if (this.#fsChangeTimer) clearTimeout(this.#fsChangeTimer);
      this.#fsChangeTimer = setTimeout(() => {
        const batch = this.#pendingFsChanges;
        this.#pendingFsChanges = [];
        this.#fsChangeTimer = null;
        void this.applyExternalChanges(batch);
      }, 300);
    });
  }

  /** React to files changed outside the editor: reload clean buffers, refresh git. */
  async applyExternalChanges(paths: string[]): Promise<void> {
    const changed = new Set(paths.map(normalize));
    for (const buf of this.buffers.items) {
      if (buf.path && changed.has(normalize(buf.path))) {
        await this.buffers.reloadFromDisk(buf.id);
      }
    }
    if (this.vcs.repo) void this.vcs.refresh(this.vcs.repo);
  }

  // --- language server (LSP) glue -----------------------------------------

  #lspSpec(buf: Buffer): ServerSpec | null {
    if (!this.settings.current.lspEnabled || !buf.path) return null;
    return serverForName(buf.name);
  }

  #lspOpen(buf: Buffer): void {
    if (buf.binary || !buf.path) return;
    const spec = this.#lspSpec(buf);
    if (!spec) return;
    const cwd = this.explorer.rootPath ?? dirname(buf.path);
    void this.lsp.openDoc(spec, buf.path, spec.languageId, buf.content, cwd);
  }

  lspDiagnostics(path: string): LspDiagnostic[] {
    return this.lsp.diagnosticsFor(path);
  }

  async lspComplete(
    path: string,
    line: number,
    character: number,
  ): Promise<LspCompletionItem[]> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    return spec ? this.lsp.completion(spec, path, line, character) : [];
  }

  async lspHover(path: string, line: number, character: number): Promise<string | null> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    return spec ? this.lsp.hover(spec, path, line, character) : null;
  }

  async lspGotoDefinition(path: string, line: number, character: number): Promise<void> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    if (!spec) return;
    const loc = await this.lsp.definition(spec, path, line, character);
    if (loc) await this.openAt(pathFromFileUri(loc.uri), loc.line + 1);
  }

  /** Find all references; jumps directly for a single hit, else opens a picker. */
  async lspFindReferences(path: string, line: number, character: number): Promise<void> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    if (!spec) return;
    const locations = await this.lsp.references(spec, path, line, character);
    if (locations.length === 0) return;
    if (locations.length === 1) {
      await this.openAt(pathFromFileUri(locations[0].uri), locations[0].line + 1);
      return;
    }
    const root = this.explorer.rootPath;
    this.referencesUi.open(
      locations.map((l) => {
        const target = pathFromFileUri(l.uri);
        const display = root ? relativeTo(root, target) : target;
        return { path: target, line: l.line + 1, label: `${display}:${l.line + 1}` };
      }),
    );
  }

  /** Rename the symbol at a position across the workspace; returns files edited. */
  async lspRename(
    path: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<number> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    if (!spec) return 0;
    const edit = await this.lsp.rename(spec, path, line, character, newName);
    if (!edit) return 0;

    let edited = 0;
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const target = pathFromFileUri(uri);
      let buf = this.buffers.items.find((b) => b.path === target);
      if (!buf) {
        await this.openPath(target);
        buf = this.buffers.items.find((b) => b.path === target);
      }
      if (buf) {
        this.setContent(buf.id, applyTextEdits(buf.content, edits));
        edited += 1;
      }
    }
    return edited;
  }

  /** All file paths under the open folder (for fuzzy quick-open). */
  async listProjectFiles(limit = 5000): Promise<string[]> {
    const root = this.explorer.rootPath;
    return root ? this.#fs.listFiles(root, limit) : [];
  }

  newFile(): void {
    const buf = this.buffers.createUntitled();
    this.layout.openInActiveLeaf(buf.id);
    this.#schedulePersist();
  }

  /** New untitled buffer pre-filled from a template, named with its extension. */
  newFileFromTemplate(template: NewFileTemplate): void {
    const buf = this.buffers.createUntitled(template.content, undefined, template.extension);
    this.layout.openInActiveLeaf(buf.id);
    this.#schedulePersist();
  }

  /** Re-encode the active file (writes immediately when it has a path). */
  async convertEncoding(encodingId: string): Promise<void> {
    const id = this.layout.activeTabId;
    const buf = id ? this.buffers.get(id) : null;
    if (!buf || buf.binary) return;
    buf.encoding = encodingId;
    if (buf.path) {
      await this.#fs.writeTextFile(buf.path, buf.content, encodingId);
      buf.savedContent = buf.content;
    }
  }

  async openPath(path: string): Promise<void> {
    const buf = await this.buffers.openPath(path);
    this.layout.openInActiveLeaf(buf.id);
    // Binary files open in the hex view; text reverts a pane out of hex mode.
    const leaf = this.layout.activeLeaf;
    if (buf.binary) {
      this.layout.setView(leaf.id, "hex");
    } else if (leaf.view === "hex") {
      this.layout.setView(leaf.id, "editor");
    }
    this.#lspOpen(buf);
  }

  /** Read a window of raw bytes (used by the hex view). */
  readChunk(path: string, offset: number, length: number): Promise<Uint8Array> {
    return this.#fs.readChunk(path, offset, length);
  }

  /** Prompt for two files and open the side-by-side comparison. */
  async pickAndCompare(): Promise<void> {
    const left = await this.#dialog.openFile();
    if (!left) return;
    const right = await this.#dialog.openFile();
    if (!right) return;
    await this.compare.run(left, right);
  }

  closeCompare(): void {
    this.compare.clear();
  }

  /** Initialize a git repo in the currently opened folder. */
  async initRepo(): Promise<void> {
    const root = this.explorer.rootPath;
    if (root) await this.vcs.init(root);
  }

  /**
   * Clone a repository: asks for the target parent folder, clones into
   * `<parent>/<repo>` (with a token credential when one matches) and opens it.
   * Returns the target path.
   */
  async cloneRepo(url: string): Promise<string> {
    const parent = await this.#dialog.openFolder();
    if (!parent) throw new Error("Nevybrána cílová složka.");
    const target = `${parent.replace(/[\\/]+$/, "")}/${repoNameFromUrl(url)}`;
    await this.vcs.clone(url, target, authHeaderFor(url, this.settings.current));
    await this.explorer.openFolder(target);
    await this.vcs.refresh(target);
    return target;
  }

  /** Show a file's git diff against HEAD in the comparison view. */
  async showGitDiff(file: string): Promise<void> {
    const rows = await this.vcs.diffHead(file);
    this.compare.showRows(`HEAD: ${file}`, file, rows);
  }

  /** Ask the AI about the current selection (or the whole active file). */
  aiAsk(action: SelectionAction): void {
    const id = this.layout.activeTabId;
    const buf = id ? this.buffers.get(id) : null;
    if (!buf || buf.binary) return;
    const selection = this.editorStatus.selectionText.trim();
    const code = selection !== "" ? selection : truncateContext(buf.content);
    void this.ai.send(buildSelectionPrompt(action, code, buf.name));
  }

  /** Generate a commit message from the staged diff via the AI provider. */
  async suggestCommitMessage(): Promise<string> {
    const diff = await this.vcs.stagedDiff();
    if (!diff.trim()) throw new Error("Žádné připravené (staged) změny.");
    return (await this.ai.complete(buildCommitPrompt(diff))).trim();
  }

  /** Toggle git blame (author per line) for the active editor's file. */
  async toggleBlame(): Promise<void> {
    if (this.vcs.blame) {
      this.vcs.clearBlame();
      return;
    }
    const id = this.layout.activeTabId;
    const buf = id ? this.buffers.get(id) : null;
    if (buf?.path && this.vcs.repo) await this.vcs.loadBlame(buf.path);
  }

  /** Format (or organize imports of) the active buffer in place. */
  async formatActive(action: FormatAction = "format"): Promise<void> {
    const id = this.layout.activeTabId;
    if (!id) return;
    const buf = this.buffers.get(id);
    if (!buf || buf.binary) return;
    try {
      const result = await this.formatter.format(buf, action);
      if (result !== null) this.buffers.setContent(id, result);
    } catch (e) {
      console.error("Formátování selhalo:", e);
      alert(`Formátování selhalo:\n${e}`);
    }
  }

  async openFromDialog(): Promise<void> {
    const path = await this.#dialog.openFile();
    if (path) await this.openPath(path);
  }

  async openFolder(): Promise<void> {
    const path = await this.#dialog.openFolder();
    if (!path) return;
    await this.explorer.openFolder(path);
    await this.vcs.refresh(path);
    void this.#watcher?.watch(path).catch(() => {});
  }

  async saveActive(): Promise<void> {
    const id = this.layout.activeTabId;
    if (id) await this.saveBuffer(id);
  }

  /** Save a buffer and, on success, record a history revision. */
  async saveBuffer(id: string): Promise<boolean> {
    const ok = await this.buffers.save(id);
    if (ok) {
      const buf = this.buffers.get(id);
      if (buf?.path) await this.history.append(buf.path, buf.content);
      if (this.vcs.repo) void this.vcs.refresh(this.vcs.repo);
      this.#schedulePersist(); // a saved buffer drops out of the untitled set
    }
    return ok;
  }

  /** Restore a buffer's content from a stored revision (undoable in the editor). */
  async restoreRevision(bufferId: string, revisionId: number): Promise<void> {
    const content = await this.history.get(revisionId);
    if (content !== null) this.buffers.setContent(bufferId, content);
  }

  setContent(id: string, content: string): void {
    this.buffers.setContent(id, content);
    const buf = this.buffers.get(id);
    // Persist unsaved (untitled) work so it survives a restart (hot exit).
    if (buf && buf.path === null) this.#schedulePersist();
    // Keep the language server's copy of the document in sync.
    if (buf && buf.path) {
      const spec = this.#lspSpec(buf);
      if (spec) this.lsp.changeDoc(spec, buf.path, content);
    }
  }

  async closeTab(leafId: string, tabId: string): Promise<void> {
    const buf = this.buffers.get(tabId);
    const lastReference = this.layout.tabRefCount(tabId) === 1;
    // Confirm only when closing would actually lose unsaved work.
    const wouldLoseWork = buf
      ? isDirty(buf) && (buf.path !== null || buf.content.length > 0)
      : false;
    if (buf && lastReference && wouldLoseWork) {
      const ok = await this.#dialog.confirm(
        `„${buf.name}" má neuložené změny. Zavřít a zahodit je?`,
      );
      if (!ok) return;
    }
    this.layout.closeTab(leafId, tabId);
    if (this.layout.tabRefCount(tabId) === 0) {
      this.buffers.close(tabId);
      if (buf?.path) {
        const spec = this.#lspSpec(buf);
        if (spec) this.lsp.closeDoc(spec, buf.path);
      }
    }
    this.#schedulePersist();
  }

  /** Project-wide search in the open folder. */
  async searchProject(query: string, maxResults = 500): Promise<SearchMatch[]> {
    const root = this.explorer.rootPath;
    if (!root || query.trim() === "") return [];
    return this.#fs.searchInFiles(root, query, maxResults);
  }

  /** Open a file and request the editor to scroll to a line. */
  async openAt(path: string, line: number): Promise<void> {
    await this.openPath(path);
    const buf = this.buffers.items.find((b) => b.path === path);
    if (buf) this.layout.requestReveal(buf.id, line);
  }

  // --- Hot exit: persist & restore never-saved (untitled) buffers ----------

  #schedulePersist(): void {
    if (this.#persistTimer) clearTimeout(this.#persistTimer);
    this.#persistTimer = setTimeout(() => void this.#persistSession(), 500);
  }

  async #persistSession(): Promise<void> {
    try {
      const items = this.buffers.items
        .filter((b) => b.path === null)
        .map((b) => ({ name: b.name, content: b.content }));
      await this.#fs.writeTextFile(await this.#sessionPath(), serializeSession(items));
    } catch {
      // best effort — losing the hot-exit cache is non-fatal
    }
  }

  /** Restore untitled buffers from the last session. Returns the count. */
  async restoreSession(): Promise<number> {
    try {
      const raw = await this.#fs.readTextFile(await this.#sessionPath());
      const items = parseSession(raw);
      for (const item of items) {
        const buf = this.buffers.createUntitled(item.content, item.name);
        this.layout.openInActiveLeaf(buf.id);
      }
      return items.length;
    } catch {
      return 0;
    }
  }

  async #sessionPath(): Promise<string> {
    return join(await appConfigDir(), "session.json");
  }

  splitActive(orientation: Orientation): void {
    this.layout.split(this.layout.activeLeafId, orientation);
  }

  /** Open a live preview of the active buffer in a new pane to the side. */
  openPreviewBeside(): void {
    this.layout.split(this.layout.activeLeafId, "row", "preview");
  }

  /** Flip the active pane between editing and preview. */
  toggleActiveView(): void {
    const leaf = this.layout.activeLeaf;
    this.layout.setView(leaf.id, leaf.view === "preview" ? "editor" : "preview");
  }
}
