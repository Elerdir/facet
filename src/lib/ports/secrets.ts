/**
 * Port for OS-level secret storage (Windows Credential Manager / macOS
 * Keychain). Tokens live here — never in plaintext settings.json.
 */
export interface SecretsPort {
  get(name: string): Promise<string | null>;
  /** Empty value deletes the secret. */
  set(name: string, value: string): Promise<void>;
}
