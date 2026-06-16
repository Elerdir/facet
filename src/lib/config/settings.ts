import { DEFAULT_AI_MODEL, isKnownAiModel } from "../domain/ai";
import { isKnownEditorTheme } from "../domain/editorThemes";
import { parseLspServers, type LspServerConfig } from "../lsp/servers";
import { parseKeybindings } from "../domain/keybindings";
import { parseSnippets, type SnippetConfig } from "../domain/snippets";
import type { CustomTemplate } from "../domain/newFileTemplates";

export interface Settings {
  autosaveEnabled: boolean;
  autosaveSeconds: number;
  historyRetentionDays: number;
  theme: "dark" | "light";
  editorTheme: string;
  lspEnabled: boolean;
  lspServers: LspServerConfig[];
  /** Command id → chord overrides for global shortcuts. */
  keybindings: Record<string, string>;
  snippets: SnippetConfig[];
  aiApiKey: string;
  aiModel: string;
  aiGhostCompletion: boolean;
  editorFontFamily: string;
  editorFontSize: number;
  editorMinimap: boolean;
  editorBreadcrumbs: boolean;
  editorStickyScroll: boolean;
  formatOnSave: boolean;
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
  editorTheme: "default",
  lspEnabled: true,
  lspServers: [],
  keybindings: {},
  snippets: [],
  aiApiKey: "",
  aiModel: DEFAULT_AI_MODEL,
  aiGhostCompletion: false,
  editorFontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
  editorFontSize: 13,
  editorMinimap: true,
  editorBreadcrumbs: true,
  editorStickyScroll: true,
  formatOnSave: false,
  fileTemplates: [],
  githubToken: "",
  gitlabToken: "",
  gitlabHost: "gitlab.com",
};

/** Settings a project's `.facet.json` may override (never secrets). */
export const PROJECT_OVERRIDABLE_KEYS = [
  "theme",
  "editorTheme",
  "editorFontFamily",
  "editorFontSize",
  "editorMinimap",
  "editorBreadcrumbs",
  "editorStickyScroll",
  "formatOnSave",
  "lspEnabled",
  "lspServers",
  "snippets",
  "autosaveEnabled",
  "autosaveSeconds",
] as const;

/**
 * Parse a project's `.facet.json` into a partial override: only keys actually
 * present and in the overridable (non-secret) set, validated via parseSettings.
 */
export function parseProjectSettings(raw: string): Partial<Settings> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};
  const present = data as Record<string, unknown>;
  const full = parseSettings(raw);
  const out: Partial<Settings> = {};
  for (const key of PROJECT_OVERRIDABLE_KEYS) {
    if (key in present) (out as Record<string, unknown>)[key] = full[key];
  }
  return out;
}

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
    editorTheme:
      typeof r.editorTheme === "string" && isKnownEditorTheme(r.editorTheme)
        ? r.editorTheme
        : DEFAULT_SETTINGS.editorTheme,
    lspEnabled:
      typeof r.lspEnabled === "boolean" ? r.lspEnabled : DEFAULT_SETTINGS.lspEnabled,
    lspServers: parseLspServers(r.lspServers),
    keybindings: parseKeybindings(r.keybindings),
    snippets: parseSnippets(r.snippets),
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
    editorStickyScroll:
      typeof r.editorStickyScroll === "boolean"
        ? r.editorStickyScroll
        : DEFAULT_SETTINGS.editorStickyScroll,
    formatOnSave:
      typeof r.formatOnSave === "boolean" ? r.formatOnSave : DEFAULT_SETTINGS.formatOnSave,
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
