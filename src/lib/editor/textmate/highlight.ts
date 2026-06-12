import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { Highlighter, BundledLanguage, BundledTheme } from "shiki";
import { tokensToStyles, styleToCss } from "./decorations";

function buildDecorations(
  view: EditorView,
  highlighter: Highlighter,
  lang: string,
  theme: string,
): DecorationSet {
  const code = view.state.doc.toString();
  let lines;
  try {
    // lang/theme are resolved at runtime, hence the cast from the bundled unions.
    lines = highlighter.codeToTokensBase(code, {
      lang: lang as BundledLanguage,
      theme: theme as BundledTheme,
    });
  } catch {
    return Decoration.none;
  }
  const builder = new RangeSetBuilder<Decoration>();
  for (const style of tokensToStyles(lines)) {
    if (style.to <= style.from) continue;
    const css = styleToCss(style);
    if (!css) continue;
    builder.add(style.from, style.to, Decoration.mark({ attributes: { style: css } }));
  }
  return builder.finish();
}

/**
 * A CodeMirror view plugin that colours the document with a TextMate grammar.
 *
 * It re-tokenizes the whole document on change — correct (TextMate tokenization
 * is stateful across lines) and fast enough for normal files. Viewport-scoped
 * tokenization for very large files is a phase-6 optimisation.
 */
export function textmateHighlighter(
  highlighter: Highlighter,
  lang: string,
  theme: string,
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, highlighter, lang, theme);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildDecorations(update.view, highlighter, lang, theme);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
