import { invoke } from "@tauri-apps/api/core";
import type { FileSystemPort } from "../ports/fileSystem";
import type { TreeEntry } from "../domain/fileTree";
import type { FileInfo } from "../domain/fileInfo";
import type { SearchMatch } from "../domain/search";

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** FileSystemPort backed by the Rust commands in `src-tauri`. */
export class TauriFileSystem implements FileSystemPort {
  readTextFile(path: string): Promise<string> {
    return invoke<string>("read_text_file", { path });
  }

  writeTextFile(path: string, contents: string, encoding?: string): Promise<void> {
    return invoke<void>("write_text_file", { path, contents, encoding: encoding ?? null });
  }

  fileInfo(path: string): Promise<FileInfo> {
    return invoke<FileInfo>("file_info", { path });
  }

  async readChunk(path: string, offset: number, length: number): Promise<Uint8Array> {
    const b64 = await invoke<string>("read_file_chunk", { path, offset, length });
    return base64ToBytes(b64);
  }

  readDir(path: string): Promise<TreeEntry[]> {
    return invoke<TreeEntry[]>("read_dir", { path });
  }

  listFiles(root: string, limit: number): Promise<string[]> {
    return invoke<string[]>("list_files", { root, limit });
  }

  searchInFiles(root: string, query: string, maxResults: number): Promise<SearchMatch[]> {
    return invoke<SearchMatch[]>("search_in_files", { root, query, maxResults });
  }
}
