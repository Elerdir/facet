/** Pure parsing for inlay hints and document highlights. */

export interface InlayHint {
  /** 0-based line/character of the hint anchor. */
  line: number;
  character: number;
  label: string;
  paddingLeft: boolean;
  paddingRight: boolean;
}

function hintLabel(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((p) => (typeof p === "string" ? p : String((p as { value?: string }).value ?? "")))
      .join("");
  }
  return "";
}

export function parseInlayHints(res: unknown): InlayHint[] {
  if (!Array.isArray(res)) return [];
  const out: InlayHint[] = [];
  for (const raw of res) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const pos = o.position as { line?: number; character?: number } | undefined;
    const label = hintLabel(o.label);
    if (!pos || label === "") continue;
    out.push({
      line: pos.line ?? 0,
      character: pos.character ?? 0,
      label,
      paddingLeft: o.paddingLeft === true,
      paddingRight: o.paddingRight === true,
    });
  }
  return out;
}

export interface LspRangeSpan {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

/** Parse a `documentHighlight` result (array of { range }). */
export function parseHighlights(res: unknown): LspRangeSpan[] {
  if (!Array.isArray(res)) return [];
  const out: LspRangeSpan[] = [];
  for (const raw of res) {
    const range = (raw as { range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } } })?.range;
    if (!range?.start || !range?.end) continue;
    out.push({
      startLine: range.start.line ?? 0,
      startCharacter: range.start.character ?? 0,
      endLine: range.end.line ?? 0,
      endCharacter: range.end.character ?? 0,
    });
  }
  return out;
}
