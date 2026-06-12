/** One entry in the find-references picker. */
export interface ReferenceItem {
  path: string;
  /** 1-based line for openAt. */
  line: number;
  label: string;
}

/** Reactive holder for the references picker (rendered by the root view). */
export class ReferencesUiStore {
  items = $state<ReferenceItem[] | null>(null);

  open(items: ReferenceItem[]): void {
    this.items = items;
  }

  close(): void {
    this.items = null;
  }
}
