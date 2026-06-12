import { invoke } from "@tauri-apps/api/core";
import type { DiffPort } from "../ports/diff";
import type { DiffRow } from "../domain/diff";

/** DiffPort backed by the Rust `diff_files` command (uses the `similar` crate). */
export class TauriDiff implements DiffPort {
  diffFiles(left: string, right: string): Promise<DiffRow[]> {
    return invoke<DiffRow[]>("diff_files", { left, right });
  }
}
