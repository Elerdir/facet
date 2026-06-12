import { isDirty, type Buffer } from "../domain/buffer";
import type { Workspace } from "./workspace";

/** Buffers eligible for autosave: dirty and backed by a real path. */
export function buffersToAutosave(buffers: readonly Buffer[]): Buffer[] {
  return buffers.filter((b) => b.path !== null && isDirty(b));
}

/**
 * Periodically flushes dirty buffers to disk (which also records a history
 * revision). The interval is supplied by `start` so it can follow settings.
 */
export class Autosave {
  #ws: Workspace;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(ws: Workspace) {
    this.#ws = ws;
  }

  start(intervalMs: number): void {
    this.stop();
    this.#timer = setInterval(() => void this.flush(), intervalMs);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** Save all eligible buffers now. Returns how many were saved. */
  async flush(): Promise<number> {
    const targets = buffersToAutosave(this.#ws.buffers.items);
    for (const buffer of targets) {
      await this.#ws.saveBuffer(buffer.id);
    }
    return targets.length;
  }
}
