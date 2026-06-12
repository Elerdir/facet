/** Pure AI-assistant domain: models, prompt builders, context truncation. */

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiModelInfo {
  id: string;
  label: string;
  /** Whether the model supports adaptive thinking. */
  adaptive: boolean;
}

export const AI_MODELS: AiModelInfo[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (nejschopnější)", adaptive: true },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (rychlý)", adaptive: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (nejlevnější)", adaptive: false },
];

export const DEFAULT_AI_MODEL = "claude-opus-4-8";

export function isKnownAiModel(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id);
}

export function modelSupportsAdaptive(id: string): boolean {
  return AI_MODELS.find((m) => m.id === id)?.adaptive ?? false;
}

/** Cap injected context so a huge file can't blow up the request. */
export const MAX_CONTEXT_CHARS = 24_000;

export function truncateContext(text: string): string {
  return text.length > MAX_CONTEXT_CHARS
    ? text.slice(0, MAX_CONTEXT_CHARS) + "\n… (zkráceno)"
    : text;
}

export interface FileContext {
  name: string;
  content: string;
}

export function buildSystemPrompt(context: FileContext | null): string {
  const base =
    "Jsi AI asistent v editoru kódu Facet. Odpovídej česky, stručně a věcně. " +
    "Kód piš do bloků ``` a u úprav vysvětli jen to podstatné.";
  if (!context) return base;
  return `${base}\n\nUživatel má otevřený soubor ${context.name}:\n\`\`\`\n${truncateContext(context.content)}\n\`\`\``;
}

export type SelectionAction = "explain" | "refactor";

export function buildSelectionPrompt(
  action: SelectionAction,
  code: string,
  fileName: string,
): string {
  const instruction =
    action === "explain"
      ? "Vysvětli, co tento kód dělá, a upozorni na případné problémy."
      : "Refaktoruj tento kód. Vrať vylepšenou verzi a stručně shrň, co se změnilo a proč.";
  return `${instruction}\n\nSoubor: ${fileName}\n\`\`\`\n${truncateContext(code)}\n\`\`\``;
}

export function buildCommitPrompt(diff: string): string {
  return (
    "Napiš commit zprávu pro následující staged diff. První řádek je shrnutí " +
    "v rozkazovacím způsobu, anglicky, max 72 znaků; případné detaily přidej " +
    "po prázdném řádku. Vrať POUZE text zprávy, nic dalšího.\n\n```diff\n" +
    truncateContext(diff) +
    "\n```"
  );
}
