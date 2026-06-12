import { appConfigDir, join } from "@tauri-apps/api/path";
import { TauriFileSystem } from "../infrastructure/tauriFileSystem";
import { registerGrammar } from "../editor/textmate/engine";
import { parseUserConfig } from "./userTemplates";
import { setUserFileTypes } from "./templates";

/**
 * Best-effort load of user templates at startup.
 *
 * Reads `<appConfigDir>/filetypes.json` for custom extension→language rules and
 * registers any referenced `.tmLanguage.json` grammars with the engine. A
 * missing or malformed config is a no-op — never fatal.
 *
 * Example `filetypes.json`:
 * {
 *   "fileTypes": [{ "extensions": ["myx"], "language": "my-lang" }],
 *   "grammars": ["my-lang.tmLanguage.json"]
 * }
 */
export async function loadUserTemplates(): Promise<void> {
  try {
    const dir = await appConfigDir();
    const fs = new TauriFileSystem();

    let raw: string;
    try {
      raw = await fs.readTextFile(await join(dir, "filetypes.json"));
    } catch {
      return; // no config file — nothing to do
    }

    const config = parseUserConfig(raw);
    setUserFileTypes(config.fileTypes);

    for (const file of config.grammars) {
      try {
        const grammarRaw = await fs.readTextFile(await join(dir, file));
        await registerGrammar(JSON.parse(grammarRaw));
      } catch {
        // skip an individual broken grammar without failing the rest
      }
    }
  } catch {
    // path API unavailable or other failure — degrade gracefully
  }
}
