import { Decoration, WidgetType, EditorView, type DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder, type Text } from "@codemirror/state";
import type { InlayHint } from "../lsp/extras";

/** Inline type/parameter hints from the language server (LSP inlay hints). */
export const setInlayHints = StateEffect.define<InlayHint[]>();

class HintWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly padL: boolean,
    readonly padR: boolean,
  ) {
    super();
  }
  eq(o: HintWidget): boolean {
    return o.text === this.text && o.padL === this.padL && o.padR === this.padR;
  }
  toDOM(): HTMLElement {
    const s = document.createElement("span");
    s.className = "cm-inlay";
    s.textContent = (this.padL ? " " : "") + this.text + (this.padR ? " " : "");
    return s;
  }
  ignoreEvent(): boolean {
    return true;
  }
}

function build(hints: InlayHint[], doc: Text): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sorted = [...hints].sort((a, b) => a.line - b.line || a.character - b.character);
  for (const h of sorted) {
    const lineNo = Math.min(Math.max(h.line + 1, 1), doc.lines);
    const l = doc.line(lineNo);
    const pos = Math.min(l.from + h.character, l.to);
    builder.add(
      pos,
      pos,
      Decoration.widget({ widget: new HintWidget(h.label, h.paddingLeft, h.paddingRight), side: 1 }),
    );
  }
  return builder.finish();
}

const field = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let set = false;
    for (const e of tr.effects) {
      if (e.is(setInlayHints)) {
        value = build(e.value, tr.state.doc);
        set = true;
      }
    }
    if (!set && tr.docChanged) value = value.map(tr.changes);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function inlayHintsField() {
  return [field];
}
