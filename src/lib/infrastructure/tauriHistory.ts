import { invoke } from "@tauri-apps/api/core";
import type { HistoryPort, RevisionMeta } from "../ports/history";

/** HistoryPort backed by the SQLite-based Rust commands. */
export class TauriHistory implements HistoryPort {
  append(path: string, content: string): Promise<void> {
    return invoke<void>("history_append", { path, content });
  }

  list(path: string): Promise<RevisionMeta[]> {
    return invoke<RevisionMeta[]>("history_list", { path });
  }

  get(id: number): Promise<string | null> {
    return invoke<string | null>("history_get", { id });
  }

  prune(cutoff: number): Promise<number> {
    return invoke<number>("history_prune", { cutoff });
  }
}
