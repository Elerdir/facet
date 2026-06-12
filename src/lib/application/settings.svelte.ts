import { appConfigDir, join } from "@tauri-apps/api/path";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "../config/settings";
import type { FileSystemPort } from "../ports/fileSystem";

/** Reactive user settings, persisted to `<appConfigDir>/settings.json`. */
export class SettingsStore {
  current = $state<Settings>({ ...DEFAULT_SETTINGS });

  #fs: FileSystemPort;

  constructor(fs: FileSystemPort) {
    this.#fs = fs;
  }

  async load(): Promise<void> {
    try {
      const raw = await this.#fs.readTextFile(await this.#path());
      this.current = parseSettings(raw);
    } catch {
      // No settings file yet — keep defaults.
    }
    this.applyTheme();
  }

  async update(patch: Partial<Settings>): Promise<void> {
    this.current = { ...this.current, ...patch };
    this.applyTheme();
    try {
      await this.#fs.writeTextFile(
        await this.#path(),
        JSON.stringify(this.current, null, 2),
      );
    } catch {
      // Best effort: in-memory settings still apply this session.
    }
  }

  applyTheme(): void {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = this.current.theme;
    }
  }

  async #path(): Promise<string> {
    return join(await appConfigDir(), "settings.json");
  }
}
