import type {
  RepoStatus,
  Branches,
  SyncOp,
  Commit,
  BlameLine,
} from "../domain/vcs";
import type { DiffRow } from "../domain/diff";

/**
 * Port for a version-control backend. Production wires the built-in Git
 * provider; a custom provider (e.g. external process) implements the same
 * interface. Tests use a fake.
 */
export interface VcsPort {
  status(repo: string): Promise<RepoStatus>;
  diffHead(repo: string, file: string): Promise<DiffRow[]>;
  stage(repo: string, file: string): Promise<void>;
  unstage(repo: string, file: string): Promise<void>;
  commit(repo: string, message: string): Promise<void>;
  branches(repo: string): Promise<Branches>;
  checkout(repo: string, name: string): Promise<void>;
  createBranch(repo: string, name: string): Promise<void>;
  /** `auth` is an optional base64 basic credential for HTTPS remotes. */
  sync(repo: string, op: SyncOp, auth?: string | null): Promise<string>;
  log(repo: string, limit: number): Promise<Commit[]>;
  blame(repo: string, file: string): Promise<BlameLine[]>;
  /** Unified diff of staged changes against HEAD. */
  stagedDiff(repo: string): Promise<string>;
  /** Unstaged unified diff of one file (working tree vs index). */
  unstagedDiff(repo: string, file: string): Promise<string>;
  /** Apply a patch to the index only (stage a hunk). */
  applyCached(repo: string, patch: string): Promise<void>;
  init(path: string): Promise<void>;
  clone(url: string, target: string, auth?: string | null): Promise<string>;
  remoteUrl(repo: string): Promise<string | null>;
  getIdentity(): Promise<{ name: string; email: string }>;
  setIdentity(name: string, email: string): Promise<void>;
}
