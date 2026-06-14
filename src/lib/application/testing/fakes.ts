import type { FileSystemPort } from "../../ports/fileSystem";
import type { DialogPort } from "../../ports/dialog";
import type { HistoryPort, RevisionMeta } from "../../ports/history";
import type { DiffPort } from "../../ports/diff";
import type { VcsPort } from "../../ports/vcs";
import type { FormatterPort } from "../../ports/formatter";
import type { TreeEntry } from "../../domain/fileTree";
import type { FileInfo } from "../../domain/fileInfo";
import type { DiffRow } from "../../domain/diff";
import type {
  RepoStatus,
  Branches,
  SyncOp,
  Commit,
  BlameLine,
} from "../../domain/vcs";
import type { SearchMatch } from "../../domain/search";
import type { LspTransport } from "../../ports/lsp";
import type { WatcherPort } from "../../ports/watcher";
import type { AiPort, AiRequest } from "../../ports/ai";
import type { SecretsPort } from "../../ports/secrets";
import type { GithubPort } from "../../ports/github";
import type { GithubRepoRef, PullRequestInfo } from "../../domain/github";
import { encodeMessage, MessageBuffer, type JsonRpcMessage } from "../../lsp/protocol";

/** In-memory FileSystemPort for unit tests. */
export class FakeFileSystem implements FileSystemPort {
  files = new Map<string, string>();
  dirs = new Map<string, TreeEntry[]>();
  /** Explicit overrides; otherwise file info is derived from `files`. */
  infos = new Map<string, FileInfo>();
  /** Explicit raw bytes; otherwise derived from `files` as UTF-8. */
  chunks = new Map<string, Uint8Array>();
  /** Encoding passed to the last write per path (for convert-encoding tests). */
  writtenEncodings = new Map<string, string | undefined>();

  async readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`Soubor nenalezen: ${path}`);
    return content;
  }

  async writeTextFile(path: string, contents: string, encoding?: string): Promise<void> {
    this.files.set(path, contents);
    this.writtenEncodings.set(path, encoding);
  }

  async fileInfo(path: string): Promise<FileInfo> {
    const explicit = this.infos.get(path);
    if (explicit) return explicit;
    const content = this.files.get(path) ?? "";
    return { size: content.length, binary: false, encoding: "UTF-8" };
  }

  async readChunk(path: string, offset: number, length: number): Promise<Uint8Array> {
    const bytes =
      this.chunks.get(path) ?? new TextEncoder().encode(this.files.get(path) ?? "");
    return bytes.slice(offset, offset + length);
  }

  async readDir(path: string): Promise<TreeEntry[]> {
    return this.dirs.get(path) ?? [];
  }

  async listFiles(root: string, limit: number): Promise<string[]> {
    return [...this.files.keys()]
      .filter((p) => p.startsWith(root))
      .slice(0, limit);
  }

  async searchInFiles(
    root: string,
    query: string,
    maxResults: number,
  ): Promise<SearchMatch[]> {
    const out: SearchMatch[] = [];
    const q = query.toLowerCase();
    for (const [path, content] of this.files) {
      if (!path.startsWith(root)) continue;
      content.split("\n").forEach((line, i) => {
        if (out.length < maxResults && line.toLowerCase().includes(q)) {
          out.push({ path, line: i + 1, text: line });
        }
      });
    }
    return out;
  }
}

/** In-memory HistoryPort for unit tests (mirrors the SQLite dedup behaviour). */
export class FakeHistory implements HistoryPort {
  private rows: { id: number; path: string; content: string; createdAt: number }[] = [];
  private nextId = 1;
  /** Monotonic clock for created_at; advances on each append. */
  now = 1000;

  async append(path: string, content: string): Promise<void> {
    const latest = [...this.rows].reverse().find((r) => r.path === path);
    if (latest && latest.content === content) return;
    this.rows.push({ id: this.nextId++, path, content, createdAt: this.now++ });
  }

  async list(path: string): Promise<RevisionMeta[]> {
    return this.rows
      .filter((r) => r.path === path)
      .map((r) => ({ id: r.id, createdAt: r.createdAt, size: r.content.length }))
      .reverse();
  }

  async get(id: number): Promise<string | null> {
    return this.rows.find((r) => r.id === id)?.content ?? null;
  }

  async prune(cutoff: number): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.createdAt >= cutoff);
    return before - this.rows.length;
  }
}

/** Scriptable DiffPort for unit tests. */
export class FakeDiff implements DiffPort {
  result: DiffRow[] = [];
  calls: [string, string][] = [];

  async diffFiles(left: string, right: string): Promise<DiffRow[]> {
    this.calls.push([left, right]);
    return this.result;
  }
}

/** Scriptable VcsPort for unit tests. */
export class FakeVcs implements VcsPort {
  repoStatus: RepoStatus = { isRepo: true, branch: "main", files: [] };
  diffResult: DiffRow[] = [];
  staged: string[] = [];
  unstaged: string[] = [];
  commits: string[] = [];

  async status(): Promise<RepoStatus> {
    return this.repoStatus;
  }
  async diffHead(): Promise<DiffRow[]> {
    return this.diffResult;
  }
  async stage(_repo: string, file: string): Promise<void> {
    this.staged.push(file);
  }
  async unstage(_repo: string, file: string): Promise<void> {
    this.unstaged.push(file);
  }
  async commit(_repo: string, message: string): Promise<void> {
    this.commits.push(message);
  }

  branchesResult: Branches = { current: "main", all: ["main"] };
  checkouts: string[] = [];
  created: string[] = [];
  syncs: SyncOp[] = [];

  async branches(): Promise<Branches> {
    return this.branchesResult;
  }
  async checkout(_repo: string, name: string): Promise<void> {
    this.checkouts.push(name);
    this.branchesResult = { ...this.branchesResult, current: name };
  }
  async createBranch(_repo: string, name: string): Promise<void> {
    this.created.push(name);
    this.branchesResult = {
      current: this.branchesResult.current,
      all: [...this.branchesResult.all, name],
    };
  }
  syncAuths: (string | null)[] = [];
  remoteUrlResult: string | null = null;
  inits: string[] = [];
  cloned: { url: string; target: string; auth: string | null }[] = [];
  identity = { name: "", email: "" };

  async sync(_repo: string, op: SyncOp, auth?: string | null): Promise<string> {
    this.syncs.push(op);
    this.syncAuths.push(auth ?? null);
    return `${op} ok`;
  }

  async init(path: string): Promise<void> {
    this.inits.push(path);
    this.repoStatus = { ...this.repoStatus, isRepo: true };
  }

  async clone(url: string, target: string, auth?: string | null): Promise<string> {
    this.cloned.push({ url, target, auth: auth ?? null });
    return "Cloning…";
  }

  async remoteUrl(): Promise<string | null> {
    return this.remoteUrlResult;
  }

  async getIdentity(): Promise<{ name: string; email: string }> {
    return this.identity;
  }

  async setIdentity(name: string, email: string): Promise<void> {
    this.identity = { name, email };
  }

  logResult: Commit[] = [];
  blameResult: BlameLine[] = [];
  stagedDiffResult = "";
  unstagedDiffResult = "";
  appliedPatches: string[] = [];

  async log(): Promise<Commit[]> {
    return this.logResult;
  }
  async blame(): Promise<BlameLine[]> {
    return this.blameResult;
  }
  async stagedDiff(): Promise<string> {
    return this.stagedDiffResult;
  }
  async unstagedDiff(): Promise<string> {
    return this.unstagedDiffResult;
  }
  async applyCached(_repo: string, patch: string): Promise<void> {
    this.appliedPatches.push(patch);
  }
}

/** Scriptable external-formatter port for unit tests. */
export class FakeFormatter implements FormatterPort {
  calls: { program: string; args: string[]; content: string }[] = [];
  result: string | null = null;

  async run(program: string, args: string[], content: string): Promise<string> {
    this.calls.push({ program, args, content });
    return this.result ?? content;
  }
}

/** In-memory LspTransport for unit tests, with helpers to script a server. */
export class FakeLspTransport implements LspTransport {
  started: { id: string; command: string }[] = [];
  sent: Uint8Array[] = [];
  #dataHandler: ((id: string, bytes: Uint8Array) => void) | null = null;

  async start(id: string, command: string, _args: string[], _cwd: string): Promise<void> {
    this.started.push({ id, command });
  }
  async send(_id: string, bytes: Uint8Array): Promise<void> {
    this.sent.push(bytes);
  }
  async stop(): Promise<void> {}
  onData(handler: (id: string, bytes: Uint8Array) => void): () => void {
    this.#dataHandler = handler;
    return () => {};
  }
  onExit(): () => void {
    return () => {};
  }

  /** Deliver a server message to the client. */
  deliver(id: string, message: object): void {
    this.#dataHandler?.(id, encodeMessage(message));
  }

  /** Decode every message the client has sent so far. */
  sentMessages(): JsonRpcMessage[] {
    const buffer = new MessageBuffer();
    const out: JsonRpcMessage[] = [];
    for (const bytes of this.sent) out.push(...buffer.append(bytes));
    return out;
  }
}

/** Scripted AiPort for unit tests: replays deltas, records requests. */
export class FakeAi implements AiPort {
  deltas: string[] = ["odpověď"];
  failWith: string | null = null;
  requests: AiRequest[] = [];

  async stream(
    request: AiRequest,
    onDelta: (text: string) => void,
  ): Promise<string> {
    this.requests.push(request);
    if (this.failWith) throw new Error(this.failWith);
    let full = "";
    for (const delta of this.deltas) {
      onDelta(delta);
      full += delta;
    }
    return full;
  }
}

/** Manually-triggered WatcherPort for unit tests. */
export class FakeWatcher implements WatcherPort {
  watched: string[] = [];
  #handler: ((paths: string[]) => void) | null = null;

  async watch(root: string): Promise<void> {
    this.watched.push(root);
  }

  onChange(handler: (paths: string[]) => void): () => void {
    this.#handler = handler;
    return () => {};
  }

  /** Simulate an external change. */
  trigger(paths: string[]): void {
    this.#handler?.(paths);
  }
}

/** Scriptable GithubPort for unit tests. */
export class FakeGithub implements GithubPort {
  pulls: PullRequestInfo[] = [];
  calls: { ref: GithubRepoRef; token: string | null }[] = [];

  async listOpenPullRequests(
    ref: GithubRepoRef,
    token: string | null,
  ): Promise<PullRequestInfo[]> {
    this.calls.push({ ref, token });
    return this.pulls;
  }
}

/** In-memory SecretsPort for unit tests. */
export class FakeSecrets implements SecretsPort {
  values = new Map<string, string>();

  async get(name: string): Promise<string | null> {
    return this.values.get(name) ?? null;
  }

  async set(name: string, value: string): Promise<void> {
    if (value === "") this.values.delete(name);
    else this.values.set(name, value);
  }
}

/** Scriptable DialogPort for unit tests. */
export class FakeDialog implements DialogPort {
  openFileResult: string | null = null;
  saveFileResult: string | null = null;
  openFolderResult: string | null = null;
  confirmResult = true;

  async openFile(): Promise<string | null> {
    return this.openFileResult;
  }

  async saveFile(): Promise<string | null> {
    return this.saveFileResult;
  }

  async openFolder(): Promise<string | null> {
    return this.openFolderResult;
  }

  async confirm(): Promise<boolean> {
    return this.confirmResult;
  }
}
