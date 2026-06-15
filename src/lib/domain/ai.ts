/** Pure AI-assistant domain: models, prompt builders, context truncation. */

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiModelInfo {
  id: string;
  label: string;
}

/** A model as returned by the Models API. */
export interface RawModel {
  id: string;
  displayName: string;
  /** Epoch ms; newer wins when collapsing a family to its latest member. */
  createdAt: number;
}

/** Current model families we surface — newest member of each, no legacy. */
const CURRENT_FAMILIES = ["fable", "opus", "sonnet", "haiku"] as const;

function familyOf(id: string): string | null {
  const match = id.match(/^claude-(fable|opus|sonnet|haiku)-/);
  return match ? match[1] : null;
}

/**
 * Reduce the live model list to the current flagship of each family. The 4.x+
 * naming (`claude-opus-4-8`, `claude-haiku-4-5`, …) is kept; older `claude-3-…`
 * legacy ids don't match the family regex and are dropped.
 */
export function selectCurrentModels(models: RawModel[]): AiModelInfo[] {
  const newest = new Map<string, RawModel>();
  for (const m of models) {
    const fam = familyOf(m.id);
    if (!fam) continue;
    const cur = newest.get(fam);
    if (!cur || m.createdAt > cur.createdAt) newest.set(fam, m);
  }
  return CURRENT_FAMILIES.flatMap((fam) => {
    const m = newest.get(fam);
    return m ? [{ id: m.id, label: m.displayName }] : [];
  });
}

export const DEFAULT_AI_MODEL = "claude-opus-4-8";

/** Accept any Claude model id (the live list is authoritative). */
export function isKnownAiModel(id: string): boolean {
  return /^claude-/.test(id);
}

/**
 * Adaptive thinking support, by id pattern: Opus/Sonnet 4.6+ and Fable yes,
 * Haiku and older no. Pattern-based so it stays correct as models advance.
 */
export function modelSupportsAdaptive(id: string): boolean {
  if (/^claude-haiku-/.test(id)) return false;
  if (/^claude-fable-/.test(id)) return true;
  const m = id.match(/^claude-(?:opus|sonnet)-(\d+)-(\d+)/);
  if (m) {
    const major = Number(m[1]);
    const minor = Number(m[2]);
    return major > 4 || (major === 4 && minor >= 6);
  }
  return false;
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

export const INLINE_EDIT_SYSTEM =
  "Jsi inline editor kódu. Dostaneš úsek kódu a instrukci. Vrať POUZE upravenou " +
  "verzi toho úseku, která ho má nahradit — žádné vysvětlení, žádné komentáře navíc, " +
  "žádné ``` bloky. Zachovej odsazení, styl a jazyk okolního kódu.";

export function buildInlineEditPrompt(
  instruction: string,
  code: string,
  fileName: string,
): string {
  return `Soubor: ${fileName}\nInstrukce: ${instruction}\n\nÚsek k úpravě:\n${truncateContext(code)}`;
}

/** Strip a single wrapping ``` code fence the model may add despite instructions. */
export function stripCodeFences(text: string): string {
  const m = text.match(/^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  return m ? m[1] : text;
}

export const MULTI_EDIT_SYSTEM =
  "Jsi AI, která upravuje kód napříč soubory. Dostaneš obsah otevřených souborů " +
  "a požadavek. Vrať POUZE úpravy ve formátu bloků (žádné jiné ``` bloky):\n\n" +
  "cesta/k/souboru\n<<<<<<< SEARCH\n přesný stávající úsek\n=======\n nový úsek\n>>>>>>> REPLACE\n\n" +
  "Pravidla: cesta na samostatném řádku přesně jako v zadání; SEARCH musí být " +
  "DOSLOVNÝ existující text z daného souboru (klidně víc řádků); uprav jen to nutné; " +
  "víc bloků i víc souborů je v pořádku. Před bloky smíš stručně shrnout záměr.";

export interface ProjectFile {
  name: string;
  content: string;
}

export function buildProjectEditPrompt(instruction: string, files: ProjectFile[]): string {
  const ctx = files
    .map((f) => `=== ${f.name} ===\n${truncateContext(f.content)}`)
    .join("\n\n");
  return `Otevřené soubory:\n\n${ctx}\n\nPožadavek: ${instruction}`;
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
