import { DEFAULT_AI_MODEL, isKnownAiModel } from "../domain/ai";

export interface Settings {
  autosaveEnabled: boolean;
  autosaveSeconds: number;
  historyRetentionDays: number;
  theme: "dark" | "light";
  lspEnabled: boolean;
  aiApiKey: string;
  aiModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveEnabled: true,
  autosaveSeconds: 30,
  historyRetentionDays: 7,
  theme: "dark",
  lspEnabled: true,
  aiApiKey: "",
  aiModel: DEFAULT_AI_MODEL,
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
  };
}
