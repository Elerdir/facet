import { open, save, confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import type { DialogPort } from "../ports/dialog";

/** DialogPort backed by `@tauri-apps/plugin-dialog`. */
export class TauriDialog implements DialogPort {
  confirm(message: string): Promise<boolean> {
    return confirmDialog(message, { title: "Facet", kind: "warning" });
  }

  async openFile(): Promise<string | null> {
    const selected = await open({ multiple: false, directory: false });
    return typeof selected === "string" ? selected : null;
  }

  async saveFile(defaultName?: string): Promise<string | null> {
    const selected = await save({ defaultPath: defaultName });
    return selected ?? null;
  }

  async openFolder(): Promise<string | null> {
    const selected = await open({ multiple: false, directory: true });
    return typeof selected === "string" ? selected : null;
  }
}
