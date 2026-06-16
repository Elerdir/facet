/** A target location (go-to-definition result). */
export interface LspLocation {
  uri: string;
  line: number;
  character: number;
}

/** A single text edit in line/character coordinates. */
export interface LspTextEdit {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  newText: string;
}

/** A rename result: edits grouped by file URI. */
export interface LspWorkspaceEdit {
  changes: Record<string, LspTextEdit[]>;
}

type RawRange = {
  start: { line: number; character: number };
  end?: { line: number; character: number };
};

function toTextEdit(e: Record<string, unknown>): LspTextEdit {
  const r = (e.range as Required<RawRange>) ?? {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
  };
  return {
    startLine: r.start.line,
    startCharacter: r.start.character,
    endLine: (r.end ?? r.start).line,
    endCharacter: (r.end ?? r.start).character,
    newText: typeof e.newText === "string" ? e.newText : "",
  };
}

/** Parse an LSP `WorkspaceEdit` (changes map or documentChanges) into our shape. */
export function parseWorkspaceEdit(res: unknown): LspWorkspaceEdit | null {
  if (!res || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const changes: Record<string, LspTextEdit[]> = {};

  if (o.changes && typeof o.changes === "object") {
    for (const [uri, edits] of Object.entries(o.changes as Record<string, unknown[]>)) {
      changes[uri] = (edits as Record<string, unknown>[]).map(toTextEdit);
    }
  } else if (Array.isArray(o.documentChanges)) {
    for (const dc of o.documentChanges as Record<string, unknown>[]) {
      const td = dc.textDocument as { uri?: string } | undefined;
      const edits = dc.edits as Record<string, unknown>[] | undefined;
      if (td?.uri && edits) changes[td.uri] = edits.map(toTextEdit);
    }
  }

  return Object.keys(changes).length > 0 ? { changes } : null;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetOf(starts: number[], line: number, character: number, length: number): number {
  const base = starts[Math.min(Math.max(line, 0), starts.length - 1)];
  return Math.min(base + character, length);
}

/**
 * Apply LSP text edits to a string. Edits are applied right-to-left so earlier
 * offsets stay valid. Pure and unit-testable.
 */
export function applyTextEdits(text: string, edits: LspTextEdit[]): string {
  const starts = lineStarts(text);
  const resolved = edits
    .map((e) => ({
      from: offsetOf(starts, e.startLine, e.startCharacter, text.length),
      to: offsetOf(starts, e.endLine, e.endCharacter, text.length),
      newText: e.newText,
    }))
    .sort((a, b) => b.from - a.from || b.to - a.to);

  let result = text;
  for (const e of resolved) {
    result = result.slice(0, e.from) + e.newText + result.slice(e.to);
  }
  return result;
}
