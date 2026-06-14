/** Reactive holder for the "stage by hunk" modal (rendered by the root view). */
export class HunkStageUiStore {
  file = $state<string | null>(null);

  open(file: string): void {
    this.file = file;
  }

  close(): void {
    this.file = null;
  }
}
