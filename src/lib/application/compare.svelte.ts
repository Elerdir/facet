import type { DiffPort } from "../ports/diff";
import type { DiffRow } from "../domain/diff";

/** Reactive state for the file-comparison mode. */
export class CompareStore {
  leftPath = $state<string | null>(null);
  rightPath = $state<string | null>(null);
  rows = $state<DiffRow[]>([]);
  loading = $state(false);
  error = $state<string | null>(null);

  #port: DiffPort;

  constructor(port: DiffPort) {
    this.#port = port;
  }

  get active(): boolean {
    return this.leftPath !== null && this.rightPath !== null;
  }

  async run(left: string, right: string): Promise<void> {
    this.leftPath = left;
    this.rightPath = right;
    this.loading = true;
    this.error = null;
    try {
      this.rows = await this.#port.diffFiles(left, right);
    } catch (e) {
      this.error = String(e);
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  /** Show pre-computed diff rows (e.g. a git diff against HEAD). */
  showRows(leftLabel: string, rightLabel: string, rows: DiffRow[]): void {
    this.leftPath = leftLabel;
    this.rightPath = rightLabel;
    this.rows = rows;
    this.error = null;
    this.loading = false;
  }

  clear(): void {
    this.leftPath = null;
    this.rightPath = null;
    this.rows = [];
    this.error = null;
    this.loading = false;
  }
}
