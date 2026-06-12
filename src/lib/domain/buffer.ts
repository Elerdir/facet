/**
 * A text buffer: the in-memory model of one open file (or unsaved document).
 * Buffers are shared across panes — the same file is one buffer regardless of
 * how many editor panes show it.
 */
export interface Buffer {
  id: string;
  /** Absolute path on disk, or null for an unsaved buffer. */
  path: string | null;
  name: string;
  content: string;
  /** Content as last loaded or saved — used to derive the dirty flag. */
  savedContent: string;
  /** Detected text encoding (e.g. "UTF-8"); "binary" for binary files. */
  encoding: string;
  /** Size in bytes on disk (0 for unsaved buffers). */
  size: number;
  /** Binary files are shown in the hex view rather than the text editor. */
  binary: boolean;
}

/** Whether the buffer has unsaved changes. */
export function isDirty(b: Buffer): boolean {
  return b.content !== b.savedContent;
}
