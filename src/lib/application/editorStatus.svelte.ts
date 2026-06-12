/** Reactive cursor/selection status of the active editor, shown in the status bar. */
export class EditorStatusStore {
  line = $state(1);
  col = $state(1);
  selection = $state(0);
  /** Text of the current selection (capped; used by AI selection actions). */
  selectionText = $state("");

  set(line: number, col: number, selection: number, selectionText = ""): void {
    this.line = line;
    this.col = col;
    this.selection = selection;
    this.selectionText = selectionText;
  }
}
