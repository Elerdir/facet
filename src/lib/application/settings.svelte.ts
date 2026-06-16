import { appConfigDir, join } from "@tauri-apps/api/path";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  parseProjectSettings,
  stripSecrets,
  SECRET_SETTINGS_KEYS,
  type Settings,
} from "../config/settings";
import type { FileSystemPort } from "../ports/fileSystem";
import type { SecretsPort } from "../ports/secrets";

/**
 * Reactive user settings. Non-secret values persist to
 * `<appConfigDir>/settings.json`; secrets (API klíče, tokeny) live in the OS
 * credential store and the file always gets them blanked. Legacy plaintext
 * secrets found in the file are migrated into the store on load.
 */
export class SettingsStore {
  #global = $state<Settings>({ ...DEFAULT_SETTINGS });
  /** Override loaded from the project's `.facet.json` (non-secret keys only). */
  #project = $state<Partial<Settings>>({});

  #fs: FileSystemPort;
  #secrets: SecretsPort | null;

  constructor(fs: FileSystemPort, secrets: SecretsPort | null = null) {
    this.#fs = fs;
    this.#secrets = secrets;
  }

  /** Effective settings: global overlaid with the project override. */
  get current(): Settings {
    return { ...this.#global, ...this.#project };
  }

  /** Replace global settings (used by tests; production uses `update`). */
  set current(value: Settings) {
    this.#global = value;
  }

  get hasProjectOverride(): boolean {
    return Object.keys(this.#project).length > 0;
  }

  async load(): Promise<void> {
    let parsed: Settings = { ...DEFAULT_SETTINGS };
    let fileHadSecrets = false;
    try {
      parsed = parseSettings(await this.#fs.readTextFile(await this.#path()));
    } catch {
      // No settings file yet — keep defaults.
    }

    if (this.#secrets) {
      for (const key of SECRET_SETTINGS_KEYS) {
        try {
          const stored = await this.#secrets.get(key);
          if (stored) {
            parsed[key] = stored;
          } else if (parsed[key].trim() !== "") {
            // Migrate a legacy plaintext secret out of settings.json.
            await this.#secrets.set(key, parsed[key]);
            fileHadSecrets = true;
          }
        } catch {
          // Credential store unavailable — keep the in-memory value.
        }
      }
    }

    this.#global = parsed;
    this.applyTheme();
    if (fileHadSecrets) await this.#persist();
  }

  /** Load (or clear) a project's `.facet.json` override from a root folder. */
  async loadProject(root: string | null): Promise<void> {
    if (!root) {
      this.#project = {};
      this.applyTheme();
      return;
    }
    try {
      const sep = root.includes("\\") ? "\\" : "/";
      const path = root.replace(/[\\/]+$/, "") + sep + ".facet.json";
      this.#project = parseProjectSettings(await this.#fs.readTextFile(path));
    } catch {
      this.#project = {};
    }
    this.applyTheme();
  }

  async update(patch: Partial<Settings>): Promise<void> {
    this.#global = { ...this.#global, ...patch };
    this.applyTheme();

    if (this.#secrets) {
      for (const key of SECRET_SETTINGS_KEYS) {
        if (key in patch) {
          try {
            await this.#secrets.set(key, this.#global[key]);
          } catch {
            // Best effort — the in-memory value still applies this session.
          }
        }
      }
    }
    await this.#persist();
  }

  applyTheme(): void {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = this.current.theme;
    }
    // Sync the native window chrome (title bar) with the app theme.
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setTheme(this.current.theme);
      } catch {
        // Outside Tauri (tests) — ignore.
      }
    })();
  }

  /** Write settings.json with every secret field blanked. */
  async #persist(): Promise<void> {
    try {
      await this.#fs.writeTextFile(
        await this.#path(),
        JSON.stringify(stripSecrets(this.#global), null, 2),
      );
    } catch {
      // Best effort: in-memory settings still apply this session.
    }
  }

  async #path(): Promise<string> {
    return join(await appConfigDir(), "settings.json");
  }
}
