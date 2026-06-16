import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder, type Text } from "@codemirror/state";
import type { LspRangeSpan } from "../lsp/extras";

/** Highlight other occurrences of the symbol under the cursor (LSP). */
export const setHighlights = StateEffect.define<LspRangeSpan[]>();

const mark = Decoration.mark({ class: "cm-doc-highlight" });

function posAt(doc: Text, line: number, character: number): number {
  const lineNo = Math.min(Math.max(line + 1, 1), doc.lines);
  const l = doc.line(lineNo);
  return Math.min(l.from + character, l.to);
}

function build(spans: LspRangeSpan[], doc: Text): DecorationSet {
  const ranges = spans
    .map((s) => ({
      from: posAt(doc, s.startLine, s.startCharacter),
      to: posAt(doc, s.endLine, s.endCharacter),
    }))
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) builder.add(r.from, r.to, mark);
  return builder.finish();
}

const field = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let set = false;
    for (const e of tr.effects) {
      if (e.is(setHighlights)) {
        value = build(e.value, tr.state.doc);
        set = true;
      }
    }
    if (!set && tr.docChanged) value = Decoration.none; // stale after edits
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function documentHighlightField() {
  return [field];
}
