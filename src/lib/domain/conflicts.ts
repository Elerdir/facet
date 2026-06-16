/** Pure parsing/resolution of Git merge-conflict markers. */

export interface Conflict {
  /** 0-based line of the `<<<<<<<` marker. */
  startLine: number;
  /** 0-based line of the `=======` separator. */
  sepLine: number;
  /** 0-based line of the `>>>>>>>` marker. */
  endLine: number;
  /** "Current" (ours) lines, between start and separator. */
  ours: string[];
  /** "Incoming" (theirs) lines, between separator and end. */
  theirs: string[];
}

export type ConflictChoice = "current" | "incoming" | "both";

export function parseConflicts(text: string): Conflict[] {
  const lines = text.split("\n");
  const out: Conflict[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith("<<<<<<<")) {
      i++;
      continue;
    }
    const startLine = i;
    let sepLine = -1;
    const ours: string[] = [];
    const theirs: string[] = [];
    i++;
    while (i < lines.length && !lines[i].startsWith("=======")) {
      ours.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break; // unterminated; ignore
    sepLine = i;
    i++;
    while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
      theirs.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break; // unterminated; ignore
    out.push({ startLine, sepLine, endLine: i, ours, theirs });
    i++;
  }
  return out;
}

/** Replace one conflict block in the text with the chosen side(s). */
export function resolveConflict(text: string, conflict: Conflict, choice: ConflictChoice): string {
  const lines = text.split("\n");
  const replacement =
    choice === "current" ? conflict.ours : choice === "incoming" ? conflict.theirs : [...conflict.ours, ...conflict.theirs];
  lines.splice(conflict.startLine, conflict.endLine - conflict.startLine + 1, ...replacement);
  return lines.join("\n");
}

/** Index of the conflict containing a 0-based line, or the first one. */
export function conflictAtLine(conflicts: Conflict[], line: number): number {
  const i = conflicts.findIndex((c) => line >= c.startLine && line <= c.endLine);
  return i >= 0 ? i : 0;
}
