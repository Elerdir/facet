import { DEFAULT_AI_MODEL, isKnownAiModel } from "../domain/ai";
import type { CustomTemplate } from "../domain/newFileTemplates";

export interface Settings {
  autosaveEnabled: boolean;
  autosaveSeconds: number;
  historyRetentionDays: number;
  theme: "dark" | "light";
  lspEnabled: boolean;
  aiApiKey: string;
  aiModel: string;
  aiGhostCompletion: boolean;
  editorFontFamily: string;
  editorFontSize: number;
  editorMinimap: boolean;
  editorBreadcrumbs: boolean;
  fileTemplates: CustomTemplate[];
  githubToken: string;
  gitlabToken: string;
  gitlabHost: string;
}

/** Settings that are secrets: stored in the OS credential store, never in
 * settings.json. (Plaintext values found in the file are migrated out.) */
export const SECRET_SETTINGS_KEYS = ["aiApiKey", "githubToken", "gitlabToken"] as const;
export type SecretSettingKey = (typeof SECRET_SETTINGS_KEYS)[number];

/** Copy of the settings with all secret fields blanked (safe to write to disk). */
export function stripSecrets(settings: Settings): Settings {
  const out = { ...settings };
  for (const key of SECRET_SETTINGS_KEYS) out[key] = "";
  return out;
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveEnabled: true,
  autosaveSeconds: 30,
  historyRetentionDays: 7,
  theme: "dark",
  lspEnabled: true,
  aiApiKey: "",
  aiModel: DEFAULT_AI_MODEL,
  aiGhostCompletion: false,
  editorFontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
  editorFontSize: 13,
  editorMinimap: true,
  editorBreadcrumbs: true,
  fileTemplates: [],
  githubToken: "",
  gitlabToken: "",
  gitlabHost: "gitlab.com",
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Parse and validate settings JSON, falling back to defaults for bad input. */
export function parseSettings(raw: string): Settings {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof data !== "object" || data === null) return { ...DEFAULT_SETTINGS };

  const r = data as Record<string, unknown>;
  return {
    autosaveEnabled:
      typeof r.autosaveEnabled === "boolean"
        ? r.autosaveEnabled
        : DEFAULT_SETTINGS.autosaveEnabled,
    autosaveSeconds: clampNumber(r.autosaveSeconds, 5, 3600, DEFAULT_SETTINGS.autosaveSeconds),
    historyRetentionDays: clampNumber(
      r.historyRetentionDays,
      1,
      365,
      DEFAULT_SETTINGS.historyRetentionDays,
    ),
    theme: r.theme === "light" ? "light" : "dark",
    lspEnabled:
      typeof r.lspEnabled === "boolean" ? r.lspEnabled : DEFAULT_SETTINGS.lspEnabled,
    aiApiKey: typeof r.aiApiKey === "string" ? r.aiApiKey : DEFAULT_SETTINGS.aiApiKey,
    aiModel:
      typeof r.aiModel === "string" && isKnownAiModel(r.aiModel)
        ? r.aiModel
        : DEFAULT_SETTINGS.aiModel,
    aiGhostCompletion:
      typeof r.aiGhostCompletion === "boolean"
        ? r.aiGhostCompletion
        : DEFAULT_SETTINGS.aiGhostCompletion,
    editorFontFamily:
      typeof r.editorFontFamily === "string" && r.editorFontFamily.trim() !== ""
        ? r.editorFontFamily
        : DEFAULT_SETTINGS.editorFontFamily,
    editorFontSize: clampNumber(r.editorFontSize, 8, 32, DEFAULT_SETTINGS.editorFontSize),
    editorMinimap:
      typeof r.editorMinimap === "boolean"
        ? r.editorMinimap
        : DEFAULT_SETTINGS.editorMinimap,
    editorBreadcrumbs:
      typeof r.editorBreadcrumbs === "boolean"
        ? r.editorBreadcrumbs
        : DEFAULT_SETTINGS.editorBreadcrumbs,
    fileTemplates: Array.isArray(r.fileTemplates)
      ? r.fileTemplates
          .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
          .filter(
            (t) =>
              typeof t.name === "string" &&
              typeof t.extension === "string" &&
              typeof t.content === "string",
          )
          .map((t) => ({
            name: t.name as string,
            extension: (t.extension as string).replace(/^\./, "").toLowerCase(),
            content: t.content as string,
            ...(typeof t.language === "string" && t.language.trim() !== ""
              ? { language: t.language.trim() }
              : {}),
          }))
      : [],
    githubToken: typeof r.githubToken === "string" ? r.githubToken : "",
    gitlabToken: typeof r.gitlabToken === "string" ? r.gitlabToken : "",
    gitlabHost:
      typeof r.gitlabHost === "string" && r.gitlabHost.trim() !== ""
        ? r.gitlabHost.trim()
        : DEFAULT_SETTINGS.gitlabHost,
  };
}
