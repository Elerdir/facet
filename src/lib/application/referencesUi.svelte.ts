/** One entry in the find-references picker. */
export interface ReferenceItem {
  path: string;
  /** 1-based line for openAt. */
  line: number;
  label: string;
}

/**
 * Reactive holder for the path/line location picker (rendered by the root
 * view). Used by find-references and "go to symbol" — anything that resolves to
 * a list of jump targets.
 */
export class ReferencesUiStore {
  items = $state<ReferenceItem[] | null>(null);
  placeholder = $state("Reference…");

  open(items: ReferenceItem[], placeholder = "Reference…"): void {
    this.items = items;
    this.placeholder = placeholder;
  }

  close(): void {
    this.items = null;
  }
}
