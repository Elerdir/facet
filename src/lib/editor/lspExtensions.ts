import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { hoverTooltip, EditorView } from "@codemirror/view";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { LspDiagnostic, LspCompletionItem } from "../application/lsp.svelte";

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

/** Autocompletion fed by the language server. */
export function lspCompletion(
  complete: (line: number, character: number) => Promise<LspCompletionItem[]>,
) {
  return autocompletion({
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        const pos = context.pos;
        const line = context.state.doc.lineAt(pos);
        const items = await complete(line.number - 1, pos - line.from);
        if (items.length === 0) return null;
        const word = context.matchBefore(/[\w$]*/);
        return {
          from: word ? word.from : pos,
          options: items.slice(0, 200).map((i) => ({
            label: i.label,
            detail: i.detail,
            type: kindToType(i.kind),
            apply: i.insertText ?? i.label,
          })),
        };
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
