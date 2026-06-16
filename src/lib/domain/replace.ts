/** Literal, case-insensitive find & replace helpers (match the Rust search). */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every case-insensitive literal occurrence of `query` with
 * `replacement`. The replacement is inserted verbatim (no `$1` expansion).
 */
export function replaceAllLiteral(
  text: string,
  query: string,
  replacement: string,
): { result: string; count: number } {
  if (query === "") return { result: text, count: 0 };
  const re = new RegExp(escapeRegExp(query), "gi");
  let count = 0;
  const result = text.replace(re, () => {
    count++;
    return replacement;
  });
  return { result, count };
}
