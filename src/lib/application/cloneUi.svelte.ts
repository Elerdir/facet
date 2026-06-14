/** Reactive flag for the "clone repository" modal (rendered by the root view). */
export class CloneUiStore {
  open = $state(false);

  show(): void {
    this.open = true;
  }

  close(): void {
    this.open = false;
  }
}
