/**
 * Port for file-system change notifications on the opened folder. Production
 * watches via Rust (`notify`); tests trigger changes manually on a fake.
 */
export interface WatcherPort {
  /** Watch a folder recursively (replaces any previous watch). */
  watch(root: string): Promise<void>;
  /** Changed paths (already noise-filtered). Returns an unsubscribe function. */
  onChange(handler: (paths: string[]) => void): () => void;
}
