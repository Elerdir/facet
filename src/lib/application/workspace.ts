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
import { HunkStageUiStore } from "./hunkUi.svelte";
import { CloneUiStore } from "./cloneUi.svelte";
import { InlineEditStore, type InlineEditTarget } from "./inlineEdit.svelte";
import { ProjectEditStore } from "./projectEdit.svelte";
import { stripCodeFences, type ProjectFile, type FileContext } from "../domain/ai";
import { parseSearchReplaceBlocks, applyFileEdits } from "../domain/multiEdit";
import { extractMentions } from "../domain/mentions";
import { CodebaseIndexStore } from "./codebaseIndex.svelte";
import { chunkFile, buildIndex, bm25Search } from "../domain/retrieval";
import {
  parseUnifiedDiff,
  buildPatch,
  type ParsedFileDiff,
  type DiffHunk,
} from "../domain/diffHunks";
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
import { DebugManager } from "./debug.svelte";
import { BreakpointStore } from "./breakpoints.svelte";
import { adapterForFile, launchConfig } from "../dap/adapters";
import type { DapTransport } from "../ports/dap";
import { serializeSession, parseSession, type SessionData } from "../config/session";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { isDirty, type Buffer } from "../domain/buffer";
import { basename, dirname, normalize, pathFromFileUri, relativeTo } from "../domain/paths";
import { applyTextEdits, type LspWorkspaceEdit } from "../lsp/edits";
import { CodeActionsUiStore } from "./codeActionsUi.svelte";
import { FileOpUiStore } from "./fileOpUi.svelte";
import { serverForName, type ServerSpec } from "../lsp/servers";
import { flattenSymbols } from "../lsp/symbols";
import type { FileSystemPort } from "../ports/fileSystem";
import type { SearchMatch } from "../domain/search";
import type { LspTransport } from "../ports/lsp";
import type { WatcherPort } from "../ports/watcher";
import type { SecretsPort } from "../ports/secrets";
import type { GithubPort } from "../ports/github";
import { parseGithubRemote, type PullRequestInfo } from "../domain/github";
import type { DialogPort } from "../ports/dialog";
import type { HistoryPort } from "../ports/history";
import type { DiffPort } from "../ports/diff";
import type { VcsPort } from "../ports/vcs";
import type { FormatterPort } from "../ports/formatter";
import type { FormatAction } from "../domain/formatting";
import type { Orientation } from "../domain/layout";

/** No-op debug transport for contexts without a real adapter (e.g. tests). */
const NULL_DAP: DapTransport = {
  async start() {},
  async send() {},
  async stop() {},
  onData() {
    return () => {};
  },
  onExit() {
    return () => {};
  },
};

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
  readonly codeActionUi = new CodeActionsUiStore();
  readonly fileOpUi = new FileOpUiStore();
  readonly lsp: LspManager;
  readonly debug: DebugManager;
  readonly breakpoints = new BreakpointStore();
  readonly ai: AiChatStore;
  readonly textFormat = new TextFormatStore();
  readonly hunkUi = new HunkStageUiStore();
  readonly cloneUi = new CloneUiStore();
  readonly inlineEdit = new InlineEditStore();
  readonly projectEditUi = new ProjectEditStore();
  #projectEditKeyToBuffer = new Map<string, string>();
  readonly codebase = new CodebaseIndexStore();

  #fs: FileSystemPort;
  #dialog: DialogPort;
  #watcher: WatcherPort | null;
  #github: GithubPort | null = null;
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
    secrets: SecretsPort | null = null,
    github: GithubPort | null = null,
    dap: DapTransport | null = null,
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
    this.settings = new SettingsStore(fs, secrets);
    this.lsp = new LspManager(lsp);
    this.lsp.applyEdit = async (edit) => (await this.#applyWorkspaceEdit(edit)) > 0;
    this.debug = new DebugManager(dap ?? NULL_DAP);
    this.ai = new AiChatStore(ai, this.settings);
    this.#fs = fs;
    this.#dialog = dialog;
    this.#watcher = watcher;
    this.#github = github;
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

  async signatureHelp(path: string, line: number, character: number) {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    return spec ? this.lsp.signatureHelp(spec, path, line, character) : null;
  }

  async lspGotoDefinition(path: string, line: number, character: number): Promise<void> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    if (!spec) return;
    const loc = await this.lsp.definition(spec, path, line, character);
    if (loc) await this.openAt(pathFromFileUri(loc.uri), loc.line + 1);
  }

  /** Find all references; jumps directly for a single hit, else opens a picker. */
  /** Document symbols (outline) for a file, via its language server. */
  async documentSymbols(path: string) {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    return spec ? this.lsp.documentSymbols(spec, path) : [];
  }

  /** Open a "go to symbol in file" picker for the active buffer. */
  async goToSymbol(): Promise<void> {
    const buf = this.activeBuffer();
    if (!buf?.path) return;
    const path = buf.path;
    const flat = flattenSymbols(await this.documentSymbols(path));
    if (flat.length === 0) return;
    this.referencesUi.open(
      flat.map((s) => ({
        path,
        line: s.line + 1,
        label: `${"  ".repeat(s.depth)}${s.name}`,
      })),
      "Přejít na symbol…",
    );
  }

  /** All current LSP diagnostics grouped by file path (for the Problems panel). */
  problemsByFile(): { path: string; diagnostics: LspDiagnostic[] }[] {
    return Object.entries(this.lsp.diagnostics)
      .map(([uri, diagnostics]) => ({ path: pathFromFileUri(uri), diagnostics }))
      .filter((f) => f.diagnostics.length > 0)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /** The buffer shown in the active tab, or null. */
  activeBuffer(): Buffer | null {
    const id = this.layout.activeTabId;
    return id ? (this.buffers.get(id) ?? null) : null;
  }

  /** Toggle a breakpoint and, if a session is live, push the file's set. */
  toggleBreakpoint(path: string, line: number): void {
    this.breakpoints.toggle(path, line);
  }

  /** Can the active file be debugged (a known adapter maps to its type)? */
  debugAdapterAvailable(): boolean {
    const buf = this.activeBuffer();
    return !!buf?.path && adapterForFile(buf.name) !== null;
  }

  /** Launch the active file under its debug adapter, with current breakpoints. */
  async startDebugging(stopOnEntry = false): Promise<void> {
    const buf = this.activeBuffer();
    if (!buf?.path) {
      this.debug.error = "Otevři soubor, který chceš ladit.";
      return;
    }
    const spec = adapterForFile(buf.name);
    if (!spec) {
      this.debug.error = `Pro ${buf.name} není nakonfigurován ladicí adaptér.`;
      return;
    }
    if (isDirty(buf)) await this.saveActive();
    const cwd = this.explorer.rootPath ?? dirname(buf.path);
    const args = launchConfig(spec, buf.path, cwd, stopOnEntry);
    await this.debug.start(spec, args, cwd, this.breakpoints.byFile());
  }

  stopDebugging(): Promise<void> {
    return this.debug.stop();
  }

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
    return this.#applyWorkspaceEdit(edit);
  }

  /** Apply an LSP workspace edit across buffers (opening closed files). */
  async #applyWorkspaceEdit(edit: LspWorkspaceEdit): Promise<number> {
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

  /** Fetch code actions (quick fixes) for a position and open the picker. */
  async requestCodeActions(path: string, line: number, character: number): Promise<void> {
    const spec = this.settings.current.lspEnabled ? serverForName(path) : null;
    if (!spec) return;
    const diagnostics = this.lspDiagnostics(path).filter(
      (d) => line >= d.line && line <= d.endLine,
    );
    const range = { startLine: line, startCharacter: character, endLine: line, endCharacter: character };
    const actions = await this.lsp.codeActions(spec, path, range, diagnostics);
    if (actions.length > 0) this.codeActionUi.open(actions, path);
  }

  /** Code actions for the active editor's cursor (command palette entry). */
  requestCodeActionsAtCursor(): void {
    const buf = this.activeBuffer();
    if (!buf?.path) return;
    void this.requestCodeActions(buf.path, this.editorStatus.line - 1, this.editorStatus.col - 1);
  }

  /** Apply the picked code action (its edit and/or its server command). */
  async applyCodeAction(index: number): Promise<void> {
    const item = this.codeActionUi.items?.[index];
    const path = this.codeActionUi.path;
    this.codeActionUi.close();
    if (!item || !path) return;
    if (item.edit) await this.#applyWorkspaceEdit(item.edit);
    if (item.command) {
      const spec = serverForName(path);
      if (spec) await this.lsp.executeCommand(spec, item.command.command, item.command.arguments);
    }
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
    this.#schedulePersist();
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

  /** Open pull requests of the repo's GitHub remote (token optional). */
  async listPullRequests(): Promise<PullRequestInfo[]> {
    if (!this.#github) throw new Error("GitHub API není k dispozici.");
    const ref = parseGithubRemote(await this.vcs.remoteUrl());
    if (!ref) throw new Error("Remote origin nemíří na GitHub.");
    const token = this.settings.current.githubToken.trim();
    return this.#github.listOpenPullRequests(ref, token !== "" ? token : null);
  }

  /** Show a file's git diff against HEAD in the comparison view. */
  async showGitDiff(file: string): Promise<void> {
    const rows = await this.vcs.diffHead(file);
    this.compare.showRows(`HEAD: ${file}`, file, rows);
  }

  /** Run a multi-file AI edit over the open text buffers; produces a review. */
  async runProjectEdit(): Promise<void> {
    const ui = this.projectEditUi;
    if (ui.instruction.trim() === "") return;

    const root = this.explorer.rootPath;
    const files: ProjectFile[] = [];
    const contentByKey = new Map<string, string>();
    this.#projectEditKeyToBuffer = new Map();
    for (const buf of this.buffers.items) {
      if (buf.binary || !buf.path) continue;
      const key = root ? relativeTo(root, buf.path) : buf.name;
      files.push({ name: key, content: buf.content });
      contentByKey.set(key, buf.content);
      this.#projectEditKeyToBuffer.set(key, buf.id);
    }
    if (files.length === 0) {
      ui.status = "error";
      ui.error = "Nejsou otevřené žádné textové soubory jako kontext.";
      return;
    }

    ui.status = "generating";
    ui.raw = "";
    ui.results = [];
    ui.error = null;
    try {
      await this.ai.projectEdit(ui.instruction, files, (delta) => (ui.raw += delta));
      ui.results = applyFileEdits(contentByKey, parseSearchReplaceBlocks(ui.raw));
      ui.status = "review";
    } catch (e) {
      ui.status = "error";
      ui.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** Apply the reviewed multi-file edit to the matching buffers. */
  acceptProjectEdit(): void {
    for (const r of this.projectEditUi.results) {
      if (!r.ok) continue;
      const bufId = this.#projectEditKeyToBuffer.get(r.path);
      if (bufId) this.setContent(bufId, r.after);
    }
    this.projectEditUi.close();
  }

  /** Open the inline AI edit panel for an explicit range (from the editor, Ctrl+K). */
  startInlineEdit(target: InlineEditTarget): void {
    this.inlineEdit.open(target);
  }

  /** Open inline AI edit from the active editor's selection (or current line). */
  startInlineEditFromStatus(): void {
    const id = this.layout.activeTabId;
    const buf = id ? this.buffers.get(id) : null;
    if (!buf || buf.binary) return;
    let { from, to } = this.editorStatus;
    if (from === to) {
      const start = buf.content.lastIndexOf("\n", from - 1) + 1;
      let end = buf.content.indexOf("\n", from);
      if (end === -1) end = buf.content.length;
      from = start;
      to = end;
    }
    this.startInlineEdit({
      bufferId: buf.id,
      from,
      to,
      original: buf.content.slice(from, to),
      fileName: buf.name,
    });
  }

  /** Run the AI for the pending inline edit, streaming into the store. */
  async runInlineEdit(): Promise<void> {
    const ie = this.inlineEdit;
    if (!ie.target || ie.instruction.trim() === "") return;
    ie.status = "generating";
    ie.generated = "";
    ie.error = null;
    try {
      await this.ai.inlineEdit(
        ie.instruction,
        ie.target.original,
        ie.target.fileName,
        (delta) => (ie.generated += delta),
      );
      ie.status = "review";
    } catch (e) {
      ie.status = "error";
      ie.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** Apply the reviewed inline edit to the buffer and close the panel. */
  acceptInlineEdit(): void {
    const ie = this.inlineEdit;
    const target = ie.target;
    if (!target) return;
    const buf = this.buffers.get(target.bufferId);
    if (!buf) {
      ie.close();
      return;
    }
    const replacement = stripCodeFences(ie.generated);
    let content: string | null = null;
    if (buf.content.slice(target.from, target.to) === target.original) {
      content = buf.content.slice(0, target.from) + replacement + buf.content.slice(target.to);
    } else if (buf.content.includes(target.original)) {
      // Offsets drifted — fall back to replacing the first occurrence.
      content = buf.content.replace(target.original, replacement);
    }
    if (content !== null) this.setContent(buf.id, content);
    ie.close();
  }

  /** Build (or rebuild) the local BM25 codebase index for the open folder. */
  async ensureCodebaseIndex(force = false): Promise<void> {
    const root = this.explorer.rootPath;
    if (!root) {
      this.codebase.status = "error";
      this.codebase.error = "Není otevřená žádná složka.";
      return;
    }
    if (this.codebase.status === "ready" && this.codebase.root === root && !force) return;

    this.codebase.status = "building";
    this.codebase.error = null;
    try {
      const files = await this.#fs.readProjectFiles(root, 4000, 200_000);
      const chunks = files.flatMap((f) => chunkFile(f.path, f.content));
      this.codebase.index = buildIndex(chunks);
      this.codebase.fileCount = files.length;
      this.codebase.root = root;
      this.codebase.status = "ready";
    } catch (e) {
      this.codebase.status = "error";
      this.codebase.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** Retrieve the most relevant code chunks for a query (local RAG). */
  async searchCodebase(query: string, topK = 6): Promise<FileContext[]> {
    await this.ensureCodebaseIndex();
    if (!this.codebase.index) return [];
    return bm25Search(this.codebase.index, query, topK).map((r) => ({
      name: `${r.chunk.path}:${r.chunk.startLine}`,
      content: r.chunk.text,
    }));
  }

  /** Resolve `@path` mentions in a chat message to file contexts (open or on disk). */
  async resolveMentions(text: string): Promise<FileContext[]> {
    const root = this.explorer.rootPath;
    const out: FileContext[] = [];
    for (const mention of extractMentions(text)) {
      if (mention.toLowerCase() === "codebase") {
        out.push(...(await this.searchCodebase(text)));
        continue;
      }
      // Prefer an already-open buffer (cheap, reflects unsaved edits).
      const open = this.buffers.items.find(
        (b) =>
          b.path !== null &&
          !b.binary &&
          ((root && relativeTo(root, b.path) === mention) || b.name === mention),
      );
      if (open) {
        out.push({ name: mention, content: open.content });
        continue;
      }
      const path = root ? normalize(`${root}/${mention}`) : mention;
      try {
        out.push({ name: mention, content: await this.#fs.readTextFile(path) });
      } catch {
        // unknown file — skip silently
      }
    }
    return out;
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

  /** Parse the unstaged hunks of a file (repo-relative path) for hunk staging. */
  async fileHunks(file: string): Promise<ParsedFileDiff | null> {
    return parseUnifiedDiff(await this.vcs.unstagedDiff(file));
  }

  /** Stage just the chosen hunks of a file by applying them to the index. */
  async stageHunks(fileHeader: string, hunks: DiffHunk[]): Promise<void> {
    if (hunks.length === 0) return;
    await this.vcs.applyCached(buildPatch(fileHeader, hunks));
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
    this.#schedulePersist();
  }

  async saveActive(): Promise<void> {
    const id = this.layout.activeTabId;
    if (id) await this.saveBuffer(id);
  }

  /** Save a buffer and, on success, record a history revision. */
  async saveBuffer(id: string): Promise<boolean> {
    if (this.settings.current.formatOnSave) {
      const buf = this.buffers.get(id);
      if (buf && !buf.binary && buf.path) {
        try {
          const formatted = await this.formatter.format(buf, "format");
          if (formatted !== null) this.buffers.setContent(id, formatted);
        } catch {
          // Save the file even if formatting fails.
        }
      }
    }
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

  // --- Explorer file management --------------------------------------------

  /** Join a directory and a name using the separator already in the path. */
  #join(dir: string, name: string): string {
    const sep = dir.includes("\\") ? "\\" : "/";
    return dir.replace(/[\\/]+$/, "") + sep + name;
  }

  promptNewFile(dir: string): void {
    this.fileOpUi.start({ kind: "newFile", dir }, "", "Název nového souboru");
  }

  promptNewFolder(dir: string): void {
    this.fileOpUi.start({ kind: "newFolder", dir }, "", "Název nové složky");
  }

  promptRename(path: string, isDir: boolean): void {
    this.fileOpUi.start({ kind: "rename", path, isDir }, basename(path), "Přejmenovat na");
  }

  /** Complete the pending file operation with the given name. */
  async submitFileOp(name: string): Promise<void> {
    const op = this.fileOpUi.op;
    this.fileOpUi.close();
    if (!op) return;
    try {
      if (op.kind === "newFile") {
        const path = this.#join(op.dir, name);
        await this.#fs.createFile(path);
        await this.explorer.reloadPath(op.dir);
        await this.openPath(path);
      } else if (op.kind === "newFolder") {
        await this.#fs.createDir(this.#join(op.dir, name));
        await this.explorer.reloadPath(op.dir);
      } else {
        const parent = dirname(op.path);
        const target = this.#join(parent, name);
        await this.#fs.rename(op.path, target);
        this.#reconcileRename(op.path, target, op.isDir);
        await this.explorer.reloadPath(parent);
      }
    } catch (e) {
      await this.#dialog.confirm(
        `Operace se nezdařila: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Move a file/folder to the recycle bin (after confirmation). */
  async deleteEntry(path: string, isDir: boolean): Promise<void> {
    const ok = await this.#dialog.confirm(
      `Přesunout „${basename(path)}" do koše?`,
    );
    if (!ok) return;
    await this.#fs.trash(path);
    this.#reconcileDelete(path, isDir);
    await this.explorer.reloadPath(dirname(path));
  }

  /** Update open buffers (and LSP) after a rename. */
  #reconcileRename(oldPath: string, newPath: string, isDir: boolean): void {
    for (const buf of this.buffers.items) {
      if (!buf.path) continue;
      let next: string | null = null;
      if (!isDir && buf.path === oldPath) next = newPath;
      else if (isDir && (buf.path.startsWith(oldPath + "/") || buf.path.startsWith(oldPath + "\\"))) {
        next = newPath + buf.path.slice(oldPath.length);
      }
      if (next === null) continue;
      const oldSpec = this.#lspSpec(buf);
      if (oldSpec) this.lsp.closeDoc(oldSpec, buf.path);
      buf.path = next;
      buf.name = basename(next);
      this.#lspOpen(buf);
    }
  }

  /** Close open buffers (and LSP) for a deleted file/folder. */
  #reconcileDelete(path: string, isDir: boolean): void {
    for (const buf of this.buffers.items) {
      if (!buf.path) continue;
      const hit = isDir
        ? buf.path.startsWith(path + "/") || buf.path.startsWith(path + "\\")
        : buf.path === path;
      if (!hit) continue;
      const spec = this.#lspSpec(buf);
      if (spec) this.lsp.closeDoc(spec, buf.path);
      this.layout.closeTabEverywhere(buf.id);
      this.buffers.close(buf.id);
    }
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

  // --- Session restore: folder, open files and unsaved buffers -------------

  #schedulePersist(): void {
    if (this.#persistTimer) clearTimeout(this.#persistTimer);
    this.#persistTimer = setTimeout(() => void this.#persistSession(), 500);
  }

  async #persistSession(): Promise<void> {
    try {
      const activeId = this.layout.activeTabId;
      const active = activeId ? this.buffers.get(activeId) : null;
      const data: SessionData = {
        untitled: this.buffers.items
          .filter((b) => b.path === null)
          .map((b) => ({ name: b.name, content: b.content })),
        folder: this.explorer.rootPath,
        files: this.buffers.items.flatMap((b) => (b.path ? [b.path] : [])),
        activePath: active?.path ?? null,
      };
      await this.#fs.writeTextFile(await this.#sessionPath(), serializeSession(data));
    } catch {
      // best effort — losing the session cache is non-fatal
    }
  }

  /** Restore the previous session (folder, files, untitled). Returns the count. */
  async restoreSession(): Promise<number> {
    try {
      const raw = await this.#fs.readTextFile(await this.#sessionPath());
      return await this.restoreFromData(parseSession(raw));
    } catch {
      return 0;
    }
  }

  /** Apply parsed session data; missing files are skipped silently. */
  async restoreFromData(data: SessionData): Promise<number> {
    let restored = 0;
    if (data.folder) {
      try {
        await this.explorer.openFolder(data.folder);
        await this.vcs.refresh(data.folder);
        void this.#watcher?.watch(data.folder).catch(() => {});
      } catch {
        // folder gone — continue with the rest
      }
    }
    for (const path of data.files) {
      try {
        await this.openPath(path);
        restored += 1;
      } catch {
        // file gone — skip
      }
    }
    for (const item of data.untitled) {
      const buf = this.buffers.createUntitled(item.content, item.name);
      this.layout.openInActiveLeaf(buf.id);
      restored += 1;
    }
    if (data.activePath) {
      const buf = this.buffers.items.find((b) => b.path === data.activePath);
      if (buf) this.layout.setActiveTab(this.layout.activeLeafId, buf.id);
    }
    return restored;
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
