import {
  groupChanges,
  type RepoStatus,
  type GroupedChanges,
  type Branches,
  type SyncOp,
  type Commit,
  type BlameLine,
} from "../domain/vcs";
import { relativeTo } from "../domain/paths";
import type { VcsPort } from "../ports/vcs";
import type { DiffRow } from "../domain/diff";

const EMPTY: RepoStatus = { isRepo: false, branch: null, files: [] };
const NO_BRANCHES: Branches = { current: null, all: [] };

/** Reactive version-control state for the currently open folder. */
export class VcsStore {
  status = $state<RepoStatus>(EMPTY);
  branches = $state<Branches>(NO_BRANCHES);
  log = $state<Commit[]>([]);
  blame = $state<{ path: string; lines: BlameLine[] } | null>(null);
  repo = $state<string | null>(null);

  #port: VcsPort;

  constructor(port: VcsPort) {
    this.#port = port;
  }

  get grouped(): GroupedChanges {
    return groupChanges(this.status.files);
  }

  async refresh(repo: string | null): Promise<void> {
    this.repo = repo;
    if (repo) {
      this.status = await this.#port.status(repo);
      if (this.status.isRepo) {
        this.branches = await this.#port.branches(repo);
        this.log = await this.#port.log(repo, 50);
      } else {
        this.branches = NO_BRANCHES;
        this.log = [];
      }
    } else {
      this.status = EMPTY;
      this.branches = NO_BRANCHES;
      this.log = [];
    }
  }

  /** Load line-by-line blame for a file (absolute path). */
  async loadBlame(path: string): Promise<void> {
    if (!this.repo) return;
    const rel = relativeTo(this.repo, path);
    try {
      this.blame = { path, lines: await this.#port.blame(this.repo, rel) };
    } catch {
      this.blame = { path, lines: [] };
    }
  }

  clearBlame(): void {
    this.blame = null;
  }

  async switchBranch(name: string): Promise<void> {
    if (!this.repo || name === this.branches.current) return;
    await this.#port.checkout(this.repo, name);
    await this.refresh(this.repo);
  }

  async createBranch(name: string): Promise<void> {
    if (!this.repo || !name.trim()) return;
    await this.#port.createBranch(this.repo, name.trim());
    await this.refresh(this.repo);
  }

  /** Run fetch/pull/push; returns the tool output. */
  async sync(op: SyncOp): Promise<string> {
    if (!this.repo) return "";
    const out = await this.#port.sync(this.repo, op);
    await this.refresh(this.repo);
    return out;
  }

  async stage(file: string): Promise<void> {
    if (!this.repo) return;
    await this.#port.stage(this.repo, file);
    await this.refresh(this.repo);
  }

  async unstage(file: string): Promise<void> {
    if (!this.repo) return;
    await this.#port.unstage(this.repo, file);
    await this.refresh(this.repo);
  }

  async commit(message: string): Promise<void> {
    if (!this.repo || !message.trim()) return;
    await this.#port.commit(this.repo, message);
    await this.refresh(this.repo);
  }

  diffHead(file: string): Promise<DiffRow[]> {
    return this.repo ? this.#port.diffHead(this.repo, file) : Promise.resolve([]);
  }

  stagedDiff(): Promise<string> {
    return this.repo ? this.#port.stagedDiff(this.repo) : Promise.resolve("");
  }
}
