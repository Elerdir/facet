/** A pending file-management operation that needs a name from the user. */
export type FileOp =
  | { kind: "newFile"; dir: string }
  | { kind: "newFolder"; dir: string }
  | { kind: "rename"; path: string; isDir: boolean };

/** Reactive holder for the name-input modal used by explorer file operations. */
export class FileOpUiStore {
  op = $state<FileOp | null>(null);
  initial = $state("");
  title = $state("");

  start(op: FileOp, initial: string, title: string): void {
    this.op = op;
    this.initial = initial;
    this.title = title;
  }

  close(): void {
    this.op = null;
    this.initial = "";
    this.title = "";
  }
}
