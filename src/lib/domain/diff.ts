/** One aligned row of a side-by-side diff (mirrors the Rust `DiffRow`). */
export interface DiffRow {
  kind: "equal" | "added" | "removed" | "changed";
  leftLine: number | null;
  left: string | null;
  rightLine: number | null;
  right: string | null;
}

export interface InlineSplit {
  /** Length of the shared leading run. */
  prefix: number;
  /** Length of the shared trailing run (not overlapping the prefix). */
  suffix: number;
}

/**
 * Common leading/trailing length of two strings — a cheap way to emphasise the
 * exact changed span within a modified line (the "better than WinMerge" touch).
 * The differing middle of `a` is `a.slice(prefix, a.length - suffix)`.
 */
export function inlineDiff(a: string, b: string): InlineSplit {
  const max = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < max && a[prefix] === b[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < max - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }
  return { prefix, suffix };
}
