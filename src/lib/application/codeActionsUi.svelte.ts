import type { CodeActionItem } from "../lsp/codeActions";

/** Reactive holder for the code-action (quick fix) picker. */
export class CodeActionsUiStore {
  items = $state<CodeActionItem[] | null>(null);
  /** File the actions apply to (needed to resolve the server for commands). */
  path = $state<string | null>(null);

  open(items: CodeActionItem[], path: string): void {
    this.items = items;
    this.path = path;
  }

  close(): void {
    this.items = null;
    this.path = null;
  }
}
