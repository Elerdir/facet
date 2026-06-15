import type { FileEditResult } from "../domain/multiEdit";

/** Reactive state for the multi-file AI edit ("apply across project") panel. */
export type ProjectEditStatus = "prompt" | "generating" | "review" | "error";

export class ProjectEditStore {
  open = $state(false);
  instruction = $state("");
  raw = $state("");
  results = $state<FileEditResult[]>([]);
  status = $state<ProjectEditStatus>("prompt");
  error = $state<string | null>(null);

  show(): void {
    this.open = true;
    this.instruction = "";
    this.raw = "";
    this.results = [];
    this.status = "prompt";
    this.error = null;
  }

  close(): void {
    this.open = false;
  }
}
