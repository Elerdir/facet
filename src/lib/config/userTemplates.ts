import type { FileTypeRule } from "../domain/fileTypes";

/**
 * Parsed user configuration. `grammars` are file names (relative to the config
 * directory) of custom `.tmLanguage.json` grammars to register.
 */
export interface UserConfig {
  fileTypes: FileTypeRule[];
  grammars: string[];
}

const EMPTY: UserConfig = { fileTypes: [], grammars: [] };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Parse and validate the user config JSON, ignoring malformed entries. Pure and
 * defensive: bad input degrades to an empty config rather than throwing.
 */
export function parseUserConfig(raw: string): UserConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof data !== "object" || data === null) return EMPTY;

  const record = data as Record<string, unknown>;

  const fileTypes: FileTypeRule[] = Array.isArray(record.fileTypes)
    ? record.fileTypes
        .filter(
          (r): r is { extensions: unknown; language: unknown } =>
            typeof r === "object" && r !== null,
        )
        .filter(
          (r) => isStringArray(r.extensions) && typeof r.language === "string",
        )
        .map((r) => ({
          extensions: (r.extensions as string[]).map((e) => e.toLowerCase()),
          language: r.language as string,
        }))
    : [];

  const grammars = isStringArray(record.grammars) ? record.grammars : [];

  return { fileTypes, grammars };
}
