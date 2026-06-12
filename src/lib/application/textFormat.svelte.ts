import type { TextFormatKind } from "../domain/textFormat";

/**
 * A pending "wrap selection" request for the active editor (bold/italic/…).
 * The CodeEditor consumes it and applies the markers around the selection.
 */
export class TextFormatStore {
  request = $state<{ kind: TextFormatKind; seq: number } | null>(null);

  #seq = 0;

  apply(kind: TextFormatKind): void {
    this.request = { kind, seq: ++this.#seq };
  }

  consume(): void {
    this.request = null;
  }
}
