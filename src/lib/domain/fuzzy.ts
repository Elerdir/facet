/**
 * Lightweight fuzzy subsequence matcher used by quick-open and the command
 * palette. Pure and unit-tested.
 */

/** Score `text` against `query`, or null when `query` isn't a subsequence. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return 0;

  let qi = 0;
  let score = 0;
  let lastMatch = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      let bonus = 1;
      if (lastMatch === ti - 1) bonus += 3; // consecutive characters
      if (ti === 0 || /[/\\._\- ]/.test(t[ti - 1])) bonus += 5; // segment start
      score += bonus;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

/** Filter + rank items by fuzzy score (best first), capped at `limit`. */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  key: (t: T) => string,
  limit = 50,
): T[] {
  if (query.trim() === "") return items.slice(0, limit);
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const s = fuzzyScore(query, key(item));
    if (s !== null) scored.push({ item, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
