import {
  ViewPlugin,
  Decoration,
  WidgetType,
  EditorView,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { findColors } from "../domain/colors";
import { findTodos } from "../domain/todo";

/**
 * Lightweight viewport-only decorations: a color swatch before every CSS color,
 * and a highlight on TODO/FIXME-style keywords. Both scan only the visible text
 * so they stay cheap on large files.
 */

class SwatchWidget extends WidgetType {
  constructor(readonly color: string) {
    super();
  }
  eq(other: SwatchWidget): boolean {
    return other.color === this.color;
  }
  toDOM(): HTMLElement {
    const s = document.createElement("span");
    s.className = "cm-color-swatch";
    s.style.backgroundColor = this.color;
    return s;
  }
  ignoreEvent(): boolean {
    return true;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Collect both kinds, then emit in document order (RangeSetBuilder needs it).
    const items: { at: number; deco: Decoration; end: number }[] = [];
    for (const c of findColors(text)) {
      items.push({
        at: from + c.from,
        end: from + c.from,
        deco: Decoration.widget({ widget: new SwatchWidget(c.color), side: -1 }),
      });
    }
    for (const t of findTodos(text)) {
      items.push({
        at: from + t.from,
        end: from + t.to,
        deco: Decoration.mark({ class: `cm-todo cm-todo-${t.kind.toLowerCase()}` }),
      });
    }
    items.sort((a, b) => a.at - b.at || a.end - b.end);
    for (const it of items) builder.add(it.at, it.end, it.deco);
  }
  return builder.finish();
}

export const editorDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
