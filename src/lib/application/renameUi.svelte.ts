/** A pending "rename symbol" request raised from the editor (F2). */
export interface RenameRequest {
  path: string;
  line: number;
  character: number;
}

/** Reactive holder for the rename dialog (the modal lives in the root view). */
export class RenameUiStore {
  request = $state<RenameRequest | null>(null);

  open(request: RenameRequest): void {
    this.request = request;
  }

  close(): void {
    this.request = null;
  }
}
