import { gutter, GutterMarker, EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { RangeSet } from "@codemirror/state";

/**
 * CodeMirror extensions for the debugger: a clickable breakpoint gutter and a
 * highlight on the line where execution is currently stopped. Reactive bits
 * (the breakpoint set, the stop line) are passed in; the editor reconfigures a
 * compartment when they change.
 */

class BreakpointMarker extends GutterMarker {
  toDOM(): Node {
    const el = document.createElement("span");
    el.className = "cm-breakpoint";
    return el;
  }
}

const marker = new BreakpointMarker();

export interface BreakpointConfig {
  /** 1-based lines that hold a breakpoint. */
  lines: number[];
  /** 1-based line where execution is stopped, or null. */
  stopLine: number | null;
  /** Toggle a breakpoint at a (1-based) line. */
  onToggle: (line: number) => void;
}

export function breakpointExtensions(config: BreakpointConfig) {
  const set = new Set(config.lines);

  const bpGutter = gutter({
    class: "cm-breakpoint-gutter",
    lineMarker(view, block) {
      const line = view.state.doc.lineAt(block.from).number;
      return set.has(line) ? marker : null;
    },
    domEventHandlers: {
      mousedown(view, block) {
        const line = view.state.doc.lineAt(block.from).number;
        config.onToggle(line);
        return true;
      },
    },
  });

  return [bpGutter, stopLineHighlight(config.stopLine)];
}

const stopLineDeco = Decoration.line({ class: "cm-debug-stop" });

function stopLineHighlight(stopLine: number | null) {
  let deco: DecorationSet = RangeSet.empty;
  if (stopLine !== null) {
    return EditorView.decorations.compute([], (state) => {
      if (stopLine < 1 || stopLine > state.doc.lines) return RangeSet.empty;
      const pos = state.doc.line(stopLine).from;
      deco = Decoration.set([stopLineDeco.range(pos)]);
      return deco;
    });
  }
  return EditorView.decorations.of(deco);
}
