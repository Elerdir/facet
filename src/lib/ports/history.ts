/** Metadata about one stored revision (content fetched on demand). */
export interface RevisionMeta {
  id: number;
  createdAt: number;
  size: number;
}

/**
 * Port for the local-history store. Production is SQLite-backed (Rust); tests
 * use an in-memory fake.
 */
export interface HistoryPort {
  append(path: string, content: string): Promise<void>;
  list(path: string): Promise<RevisionMeta[]>;
  get(id: number): Promise<string | null>;
  /** Delete revisions older than the cutoff (unix ms); returns count removed. */
  prune(cutoff: number): Promise<number>;
}
