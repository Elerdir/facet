export type FileChangeKind =
  | "modified"
  | "added"
  | "deleted"
  | "untracked"
  | "renamed";

export interface FileStatus {
  path: string;
  status: FileChangeKind;
  staged: boolean;
}

export interface RepoStatus {
  isRepo: boolean;
  branch: string | null;
  files: FileStatus[];
}

export interface GroupedChanges {
  staged: FileStatus[];
  unstaged: FileStatus[];
}

export interface Branches {
  current: string | null;
  all: string[];
}

export type SyncOp = "fetch" | "pull" | "push";

export interface Commit {
  hash: string;
  message: string;
  author: string;
  time: number;
}

export interface BlameLine {
  line: number;
  hash: string;
  author: string;
}

export interface StashEntry {
  index: number;
  message: string;
}

/** Split a flat status list into staged and unstaged groups (pure). */
export function groupChanges(files: FileStatus[]): GroupedChanges {
  return {
    staged: files.filter((f) => f.staged),
    unstaged: files.filter((f) => !f.staged),
  };
}

/** One-letter badge for a change kind. */
export function statusBadge(kind: FileChangeKind): string {
  switch (kind) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "untracked":
      return "U";
    case "renamed":
      return "R";
    default:
      return "M";
  }
}
