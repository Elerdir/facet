import {
  autocompletion,
  completeAnyWord,
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { hoverTooltip, EditorView } from "@codemirror/view";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { LspDiagnostic, LspCompletionItem } from "../application/lsp.svelte";
import { normalizeSnippet, type SnippetConfig } from "../domain/snippets";

const SEVERITY: Record<number, Diagnostic["severity"]> = {
  1: "error",
  2: "warning",
  3: "info",
  4: "info",
};

function posAt(doc: Text, line: number, character: number): number {
  const lineNo = Math.min(Math.max(line + 1, 1), doc.lines);
  const l = doc.line(lineNo);
  return Math.min(l.from + character, l.to);
}

/** Convert LSP diagnostics to CodeMirror diagnostics for the current document. */
export function mapDiagnostics(view: EditorView, diags: LspDiagnostic[]): Diagnostic[] {
  const doc = view.state.doc;
  return diags.map((d) => {
    const from = posAt(doc, d.line, d.character);
    const to = posAt(doc, d.endLine, d.endCharacter);
    return {
      from: Math.min(from, to),
      to: Math.max(from, to),
      severity: SEVERITY[d.severity] ?? "info",
      message: d.message,
    };
  });
}

/** A linter that surfaces the current LSP diagnostics (squiggles). */
export function lspLinter(getDiagnostics: () => LspDiagnostic[]) {
  return linter((view) => mapDiagnostics(view, getDiagnostics()));
}

function kindToType(kind?: number): string | undefined {
  switch (kind) {
    case 2:
    case 3:
    case 4:
      return "function";
    case 5:
      return "property";
    case 6:
    case 13:
      return "variable";
    case 7:
    case 8:
      return "class";
    case 9:
      return "namespace";
    case 14:
      return "keyword";
    case 21:
      return "constant";
    default:
      return undefined;
  }
}

/**
 * Combined completion: snippets (with tab-stops) for the buffer's language plus
 * either LSP items (when a server is active) or plain word completion.
 */
export function completionExtension(opts: {
  snippets: SnippetConfig[];
  lspComplete?: (line: number, character: number) => Promise<LspCompletionItem[]>;
}) {
  const snippetOptions: Completion[] = opts.snippets.map((s) =>
    snippetCompletion(normalizeSnippet(s.body), {
      label: s.prefix,
      detail: s.description ?? "úryvek",
      type: "snippet",
    }),
  );

  return autocompletion({
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        const pos = context.pos;
        const word = context.matchBefore(/[\w$]*/);
        const from = word ? word.from : pos;
        const options: Completion[] = [...snippetOptions];

        if (opts.lspComplete) {
          const line = context.state.doc.lineAt(pos);
          const items = await opts.lspComplete(line.number - 1, pos - line.from);
          for (const i of items.slice(0, 200)) {
            options.push({
              label: i.label,
              detail: i.detail,
              type: kindToType(i.kind),
              apply: i.insertText ?? i.label,
            });
          }
        } else {
          const any = await completeAnyWord(context);
          if (any) for (const o of any.options) options.push(o);
        }

        if (options.length === 0) return null;
        return { from, options };
      },
    ],
  });
}

/** Hover tooltips from the language server. */
export function lspHoverTooltip(
  hover: (line: number, character: number) => Promise<string | null>,
) {
  return hoverTooltip(async (view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const text = await hover(line.number - 1, pos - line.from);
    if (!text) return null;
    return {
      pos,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-lsp-hover";
        dom.textContent = text;
        return { dom };
      },
    };
  });
}
