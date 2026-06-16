import { lineDiff } from "./lineDiff";

/** Per-line change classification vs the git HEAD version of a file. */
export type ChangeKind = "added" | "modified" | "removed";

/**
 * Compute git-style change markers for the editor gutter: which *current* lines
 * (1-based) were added or modified relative to `head`, and where lines were
 * removed. Pure and unit-testable.
 *
 * - `added`    — new lines with no corresponding removed lines.
 * - `modified` — added lines in a block that also removed lines.
 * - `removed`  — a deletion with no replacement; marked on the line above it.
 */
export function changeMarkers(head: string, current: string): Map<number, ChangeKind> {
  const markers = new Map<number, ChangeKind>();

  // A file absent from HEAD comes through as empty: treat every line as added.
  if (head === "") {
    if (current === "") return markers;
    const n = current.split("\n").length;
    for (let l = 1; l <= n; l++) markers.set(l, "added");
    return markers;
  }

  const ops = lineDiff(head, current);
  let line = 0; // last seen current-buffer line (1-based)
  let i = 0;
  while (i < ops.length) {
    if (ops[i].kind === "same") {
      line++;
      i++;
      continue;
    }
    // Gather a contiguous change block (consecutive del/add ops).
    let dels = 0;
    let adds = 0;
    while (i < ops.length && ops[i].kind !== "same") {
      if (ops[i].kind === "del") {
        dels++;
      } else {
        line++;
        adds++;
        markers.set(line, dels > 0 ? "modified" : "added");
      }
      i++;
    }
    // A pure deletion: flag the line above (or the first line at the top).
    if (adds === 0 && dels > 0) markers.set(Math.max(line, 1), "removed");
  }
  return markers;
}
