/** Reactive cursor/selection status of the active editor, shown in the status bar. */
export class EditorStatusStore {
  line = $state(1);
  col = $state(1);
  selection = $state(0);
  /** Text of the current selection (capped; used by AI selection actions). */
  selectionText = $state("");
  /** Absolute selection offsets in the document (for inline AI edit). */
  from = $state(0);
  to = $state(0);

  set(
    line: number,
    col: number,
    selection: number,
    selectionText = "",
    from = 0,
    to = 0,
  ): void {
    this.line = line;
    this.col = col;
    this.selection = selection;
    this.selectionText = selectionText;
    this.from = from;
    this.to = to;
  }
}
