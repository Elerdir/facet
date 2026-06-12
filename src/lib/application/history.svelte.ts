import type { HistoryPort, RevisionMeta } from "../ports/history";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reactive view over the local history: holds the revision list for the file
 * currently shown in the history panel, plus retention/pruning policy.
 */
export class HistoryStore {
  revisions = $state<RevisionMeta[]>([]);
  currentPath = $state<string | null>(null);

  #port: HistoryPort;
  #retentionMs: number;

  constructor(port: HistoryPort, retentionDays = 7) {
    this.#port = port;
    this.#retentionMs = retentionDays * DAY_MS;
  }

  append(path: string, content: string): Promise<void> {
    return this.#port.append(path, content);
  }

  async load(path: string): Promise<void> {
    this.currentPath = path;
    this.revisions = await this.#port.list(path);
  }

  get(id: number): Promise<string | null> {
    return this.#port.get(id);
  }

  setRetentionDays(days: number): void {
    this.#retentionMs = days * DAY_MS;
  }

  /** Remove revisions older than the retention window. Returns count removed. */
  pruneOld(now: number = Date.now()): Promise<number> {
    return this.#port.prune(now - this.#retentionMs);
  }

  clear(): void {
    this.currentPath = null;
    this.revisions = [];
  }
}
