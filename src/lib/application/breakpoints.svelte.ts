/**
 * Reactive set of source breakpoints, keyed by file path. Pure state — the
 * `DebugManager` reads it when a session starts and when the user toggles a
 * line, and the editor gutter renders/toggles from it.
 */
export interface Breakpoint {
  path: string;
  /** 1-based line number (matches the editor gutter). */
  line: number;
}

export class BreakpointStore {
  list = $state<Breakpoint[]>([]);

  /** Add a breakpoint on a line, or remove it if already present. */
  toggle(path: string, line: number): void {
    const i = this.list.findIndex((b) => b.path === path && b.line === line);
    if (i >= 0) this.list = [...this.list.slice(0, i), ...this.list.slice(i + 1)];
    else this.list = [...this.list, { path, line }].sort((a, b) => a.line - b.line);
  }

  /** 1-based lines with a breakpoint in the given file. */
  linesFor(path: string): number[] {
    return this.list.filter((b) => b.path === path).map((b) => b.line);
  }

  /** Breakpoints grouped by file, for sending to the adapter. */
  byFile(): { path: string; lines: number[] }[] {
    const map = new Map<string, number[]>();
    for (const b of this.list) {
      const arr = map.get(b.path) ?? [];
      arr.push(b.line);
      map.set(b.path, arr);
    }
    return [...map.entries()].map(([path, lines]) => ({ path, lines }));
  }

  clear(): void {
    this.list = [];
  }
}
