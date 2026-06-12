import type { Extension } from "@codemirror/state";
import { hasLezerLanguage, loadLanguage } from "./languages";
import { resolveLanguageId } from "../domain/fileTypes";
import { getUserFileTypes } from "../config/templates";
import { ensureLanguage, getHighlighter, DEFAULT_THEME } from "./textmate/engine";
import { textmateHighlighter } from "./textmate/highlight";

/**
 * How a file should be highlighted:
 *  - `lezer`    — a fast native CodeMirror grammar (common languages)
 *  - `textmate` — a TextMate grammar loaded on demand (everything else + custom)
 *  - `none`     — plain text
 */
export type Highlighting =
  | { kind: "lezer" }
  | { kind: "textmate"; lang: string }
  | { kind: "none" };

export function resolveHighlighting(name: string): Highlighting {
  if (hasLezerLanguage(name)) return { kind: "lezer" };
  const lang = resolveLanguageId(name, getUserFileTypes());
  if (lang) return { kind: "textmate", lang };
  return { kind: "none" };
}

/**
 * Load the highlighting extension for a file. Everything is lazy and
 * code-split: Lezer parsers, the Shiki engine and individual TextMate grammars
 * each arrive as their own chunk only when first needed.
 */
export async function loadHighlightExtension(name: string): Promise<Extension | null> {
  const resolved = resolveHighlighting(name);
  if (resolved.kind === "lezer") return loadLanguage(name);
  if (resolved.kind === "textmate") return loadTextmateExtension(resolved.lang);
  return null;
}

/**
 * Load a TextMate language and build its CodeMirror highlighting extension.
 * Returns null when the grammar can't be loaded (e.g. unknown language).
 */
export async function loadTextmateExtension(lang: string): Promise<Extension | null> {
  const ok = await ensureLanguage(lang);
  if (!ok) return null;
  const highlighter = await getHighlighter();
  return textmateHighlighter(highlighter, lang, DEFAULT_THEME);
}
