/** Reactive state for the inline AI edit (Ctrl+K) panel. */

export interface InlineEditTarget {
  bufferId: string;
  /** Absolute offsets of the targeted range in the buffer at capture time. */
  from: number;
  to: number;
  original: string;
  fileName: string;
}

export type InlineEditStatus = "prompt" | "generating" | "review" | "error";

export class InlineEditStore {
  target = $state<InlineEditTarget | null>(null);
  instruction = $state("");
  generated = $state("");
  status = $state<InlineEditStatus>("prompt");
  error = $state<string | null>(null);

  open(target: InlineEditTarget): void {
    this.target = target;
    this.instruction = "";
    this.generated = "";
    this.status = "prompt";
    this.error = null;
  }

  close(): void {
    this.target = null;
  }
}
