import type { CodebaseIndex } from "../domain/retrieval";

/** Reactive holder for the local codebase (BM25) index. */
export type CodebaseStatus = "empty" | "building" | "ready" | "error";

export class CodebaseIndexStore {
  index = $state<CodebaseIndex | null>(null);
  status = $state<CodebaseStatus>("empty");
  fileCount = $state(0);
  error = $state<string | null>(null);
  /** Root the current index was built for (invalidates on folder change). */
  root = $state<string | null>(null);
}
