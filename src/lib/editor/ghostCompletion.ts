import {
  StateEffect,
  StateField,
  Annotation,
  Prec,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  WidgetType,
  keymap,
  type ViewUpdate,
} from "@codemirror/view";

/** Fetches a completion for the cursor; rejects/empty means "no suggestion". */
export type GhostFetch = (
  params: { prefix: string; suffix: string },
  signal: AbortSignal,
) => Promise<string>;

interface Ghost {
  from: number;
  text: string;
}

const setGhost = StateEffect.define<Ghost | null>();
const ghostAccepted = Annotation.define<boolean>();

const ghostField = StateField.define<Ghost | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setGhost)) return e.value;
    // Any typing or cursor move invalidates the pending suggestion.
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
});

class GhostInline extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: GhostInline): boolean {
    return other.text === this.text;
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost";
    span.textContent = this.text;
    return span;
  }
}

class GhostBlock extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: GhostBlock): boolean {
    return other.text === this.text;
  }
  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-ghost cm-ghost-block";
    div.textContent = this.text;
    return div;
  }
}

const ghostDecorations = EditorView.decorations.compute([ghostField], (state) => {
  const g = state.field(ghostField);
  if (!g || g.text === "") return Decoration.none;
  const lines = g.text.split("\n");
  const ranges = [
    Decoration.widget({ widget: new GhostInline(lines[0]), side: 1 }).range(g.from),
  ];
  if (lines.length > 1) {
    const lineEnd = state.doc.lineAt(g.from).to;
    ranges.push(
      Decoration.widget({
        widget: new GhostBlock(lines.slice(1).join("\n")),
        block: true,
        side: 1,
      }).range(lineEnd),
    );
  }
  return Decoration.set(ranges, true);
});

function acceptGhost(view: EditorView): boolean {
  const g = view.state.field(ghostField, false);
  if (!g) return false;
  view.dispatch({
    changes: { from: g.from, insert: g.text },
    selection: { anchor: g.from + g.text.length },
    effects: setGhost.of(null),
    annotations: ghostAccepted.of(true),
  });
  return true;
}

function dismissGhost(view: EditorView): boolean {
  if (!view.state.field(ghostField, false)) return false;
  view.dispatch({ effects: setGhost.of(null) });
  return true;
}

function requester(fetch: GhostFetch, delay: number): Extension {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ctrl: AbortController | null = null;

  return EditorView.updateListener.of((u: ViewUpdate) => {
    if (u.transactions.some((t) => t.annotation(ghostAccepted))) return;
    if (!u.docChanged && !u.selectionSet) return;

    if (timer) clearTimeout(timer);
    ctrl?.abort();
    if (!u.docChanged) return; // a pure cursor move just clears the ghost

    const view = u.view;
    timer = setTimeout(() => {
      const sel = view.state.selection.main;
      if (sel.from !== sel.to) return; // no suggestion while selecting
      const pos = sel.head;
      const doc = view.state.doc;
      const prefix = doc.sliceString(Math.max(0, pos - 4000), pos);
      const suffix = doc.sliceString(pos, Math.min(doc.length, pos + 1000));
      ctrl = new AbortController();
      const signal = ctrl.signal;
      void fetch({ prefix, suffix }, signal)
        .then((text) => {
          if (signal.aborted) return;
          const cur = view.state.selection.main;
          if (cur.head !== pos || cur.from !== cur.to) return; // moved meanwhile
          const clean = text.replace(/\r/g, "");
          if (clean.trim() === "") return;
          view.dispatch({ effects: setGhost.of({ from: pos, text: clean }) });
        })
        .catch(() => {});
    }, delay);
  });
}

/** Inline AI ghost completion: gray suggestion at the cursor, Tab accepts. */
export function ghostCompletion(fetch: GhostFetch, delay = 500): Extension {
  return [
    ghostField,
    ghostDecorations,
    requester(fetch, delay),
    Prec.highest(
      keymap.of([
        { key: "Tab", run: acceptGhost },
        { key: "Escape", run: dismissGhost },
      ]),
    ),
    EditorView.baseTheme({
      ".cm-ghost": { opacity: "0.45", fontStyle: "italic" },
      ".cm-ghost-block": { whiteSpace: "pre" },
    }),
  ];
}
