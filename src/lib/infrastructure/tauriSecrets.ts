import { invoke } from "@tauri-apps/api/core";
import type { SecretsPort } from "../ports/secrets";

/** SecretsPort backed by the OS credential store via the Rust `keyring` crate. */
export class TauriSecrets implements SecretsPort {
  get(name: string): Promise<string | null> {
    return invoke<string | null>("secret_get", { name });
  }

  set(name: string, value: string): Promise<void> {
    return invoke<void>("secret_set", { name, value });
  }
}
