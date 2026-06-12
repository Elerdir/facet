import type { Highlighter, BundledLanguage, LanguageRegistration } from "shiki";

/** Default Shiki theme used for TextMate-highlighted files. */
export const DEFAULT_THEME = "github-dark";

let highlighterPromise: Promise<Highlighter> | null = null;

// Shiki (engine + Oniguruma WASM) is dynamically imported so it stays out of
// the startup bundle entirely — it loads the first time a TextMate-highlighted
// file is opened.
function init(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((shiki) =>
      shiki.createHighlighter({
        themes: [DEFAULT_THEME],
        langs: [],
      }),
    );
  }
  return highlighterPromise;
}

/** The shared, lazily-created Shiki highlighter. */
export function getHighlighter(): Promise<Highlighter> {
  return init();
}

/**
 * Ensure a bundled grammar is loaded (loaded on demand and code-split by the
 * bundler). Returns false for unknown languages instead of throwing.
 */
export async function ensureLanguage(lang: string): Promise<boolean> {
  const hl = await init();
  if (hl.getLoadedLanguages().includes(lang)) return true;
  try {
    await hl.loadLanguage(lang as BundledLanguage);
    return true;
  } catch {
    return false;
  }
}

/** Register a user-supplied TextMate grammar (custom template). */
export async function registerGrammar(grammar: LanguageRegistration): Promise<void> {
  const hl = await init();
  await hl.loadLanguage(grammar);
}
