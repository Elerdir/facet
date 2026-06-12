import { invoke } from "@tauri-apps/api/core";
import type { VcsPort } from "../ports/vcs";
import type {
  RepoStatus,
  Branches,
  SyncOp,
  Commit,
  BlameLine,
} from "../domain/vcs";
import type { DiffRow } from "../domain/diff";

/** VcsPort backed by the built-in Git provider (libgit2) in Rust. */
export class TauriVcs implements VcsPort {
  status(repo: string): Promise<RepoStatus> {
    return invoke<RepoStatus>("git_status", { repo });
  }

  diffHead(repo: string, file: string): Promise<DiffRow[]> {
    return invoke<DiffRow[]>("git_diff_head", { repo, file });
  }

  stage(repo: string, file: string): Promise<void> {
    return invoke<void>("git_stage", { repo, file });
  }

  unstage(repo: string, file: string): Promise<void> {
    return invoke<void>("git_unstage", { repo, file });
  }

  commit(repo: string, message: string): Promise<void> {
    return invoke<void>("git_commit", { repo, message });
  }

  branches(repo: string): Promise<Branches> {
    return invoke<Branches>("git_branches", { repo });
  }

  checkout(repo: string, name: string): Promise<void> {
    return invoke<void>("git_checkout", { repo, name });
  }

  createBranch(repo: string, name: string): Promise<void> {
    return invoke<void>("git_create_branch", { repo, name });
  }

  sync(repo: string, op: SyncOp, auth?: string | null): Promise<string> {
    return invoke<string>("git_sync", { repo, op, auth: auth ?? null });
  }

  init(path: string): Promise<void> {
    return invoke<void>("git_init", { path });
  }

  clone(url: string, target: string, auth?: string | null): Promise<string> {
    return invoke<string>("git_clone", { url, target, auth: auth ?? null });
  }

  remoteUrl(repo: string): Promise<string | null> {
    return invoke<string | null>("git_remote_url", { repo });
  }

  getIdentity(): Promise<{ name: string; email: string }> {
    return invoke<{ name: string; email: string }>("git_get_identity");
  }

  setIdentity(name: string, email: string): Promise<void> {
    return invoke<void>("git_set_identity", { name, email });
  }

  log(repo: string, limit: number): Promise<Commit[]> {
    return invoke<Commit[]>("git_log", { repo, limit });
  }

  blame(repo: string, file: string): Promise<BlameLine[]> {
    return invoke<BlameLine[]>("git_blame", { repo, file });
  }

  stagedDiff(repo: string): Promise<string> {
    return invoke<string>("git_staged_diff", { repo });
  }
}
