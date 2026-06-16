/** Find TODO-style annotation keywords in text for editor highlighting. Pure. */

export const TODO_KEYWORDS = ["TODO", "FIXME", "HACK", "XXX", "BUG", "NOTE"] as const;
export type TodoKind = (typeof TODO_KEYWORDS)[number];

const TODO_RE = new RegExp(`\\b(${TODO_KEYWORDS.join("|")})\\b`, "g");

export interface TodoMatch {
  from: number;
  to: number;
  kind: TodoKind;
}

export function findTodos(text: string): TodoMatch[] {
  const out: TodoMatch[] = [];
  for (const m of text.matchAll(TODO_RE)) {
    if (m.index === undefined) continue;
    out.push({ from: m.index, to: m.index + m[0].length, kind: m[0] as TodoKind });
  }
  return out;
}
