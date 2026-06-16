import type { TreeEntry } from "../domain/fileTree";
import type { FileInfo } from "../domain/fileInfo";
import type { SearchMatch } from "../domain/search";

/**
 * Port for file-system access. The application layer depends on this interface,
 * not on Tauri — production wires `TauriFileSystem`, tests wire an in-memory fake.
 */
export interface FileSystemPort {
  readTextFile(path: string): Promise<string>;
  /** Bulk-read project text files (gitignore-aware, capped) for indexing. */
  readProjectFiles(
    root: string,
    maxFiles: number,
    maxBytes: number,
  ): Promise<{ path: string; content: string }[]>;
  /** Write text; `encoding` (e.g. "utf-16le") re-encodes, default UTF-8. */
  writeTextFile(path: string, contents: string, encoding?: string): Promise<void>;
  /** Size, binary flag and encoding without loading the whole file. */
  fileInfo(path: string): Promise<FileInfo>;
  /** Read a window of raw bytes (for the hex view / large files). */
  readChunk(path: string, offset: number, length: number): Promise<Uint8Array>;
  readDir(path: string): Promise<TreeEntry[]>;
  /** Create an empty file (fails if the path already exists). */
  createFile(path: string): Promise<void>;
  /** Create a directory (and missing parents). */
  createDir(path: string): Promise<void>;
  /** Rename/move a file or folder (fails if the target exists). */
  rename(from: string, to: string): Promise<void>;
  /** Move a file or folder to the OS recycle bin. */
  trash(path: string): Promise<void>;
  /** Recursively list file paths under root (for fuzzy quick-open). */
  listFiles(root: string, limit: number): Promise<string[]>;
  /** Project-wide literal search (respects .gitignore, skips binaries). */
  searchInFiles(root: string, query: string, maxResults: number): Promise<SearchMatch[]>;
}
