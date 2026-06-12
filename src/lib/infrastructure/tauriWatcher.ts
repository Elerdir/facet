import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WatcherPort } from "../ports/watcher";

/** WatcherPort backed by the Rust `watch_folder` command + `fs:change` events. */
export class TauriWatcher implements WatcherPort {
  watch(root: string): Promise<void> {
    return invoke<void>("watch_folder", { root });
  }

  onChange(handler: (paths: string[]) => void): () => void {
    const un = listen<string[]>("fs:change", (e) => handler(e.payload));
    return () => void un.then((f) => f());
  }
}
