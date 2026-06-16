/** Pure parsing of LSP documentSymbol responses into a uniform tree. */

export interface DocSymbol {
  name: string;
  kind: number;
  /** 0-based line of the symbol. */
  line: number;
  /** 0-based last line of the symbol's full extent (>= line). */
  endLine: number;
  children: DocSymbol[];
}

interface Range {
  start: { line: number; character: number };
  end?: { line: number; character: number };
}

function lineOf(o: Record<string, unknown>): number {
  const loc = o.location as { range?: Range } | undefined;
  if (loc?.range) return loc.range.start.line; // SymbolInformation
  const sel = o.selectionRange as Range | undefined;
  if (sel) return sel.start.line;
  const range = o.range as Range | undefined;
  return range ? range.start.line : 0;
}

/** Last line of the symbol's full body, for cursor-containment (breadcrumbs). */
function endLineOf(o: Record<string, unknown>, start: number): number {
  const loc = o.location as { range?: Range } | undefined;
  const range = (o.range as Range | undefined) ?? loc?.range;
  return range?.end ? range.end.line : start;
}

function mapSymbol(item: unknown): DocSymbol | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const children = Array.isArray(o.children)
    ? (o.children.map(mapSymbol).filter((s): s is DocSymbol => s !== null))
    : [];
  const line = lineOf(o);
  return {
    name: typeof o.name === "string" ? o.name : "",
    kind: typeof o.kind === "number" ? o.kind : 0,
    line,
    endLine: Math.max(line, endLineOf(o, line)),
    children,
  };
}

/**
 * The chain of symbols (outermost → innermost) whose extent contains a 0-based
 * line. Used by the breadcrumb bar to show "Class › method" for the cursor.
 */
export function symbolTrail(symbols: DocSymbol[], line: number): DocSymbol[] {
  for (const sym of symbols) {
    if (line >= sym.line && line <= sym.endLine) {
      return [sym, ...symbolTrail(sym.children, line)];
    }
  }
  return [];
}

/** Parse a `textDocument/documentSymbol` result (hierarchical or flat). */
export function parseDocumentSymbols(res: unknown): DocSymbol[] {
  if (!Array.isArray(res)) return [];
  return res.map(mapSymbol).filter((s): s is DocSymbol => s !== null);
}

const KIND_NAMES: Record<number, string> = {
  1: "Soubor",
  2: "Modul",
  3: "Namespace",
  4: "Balík",
  5: "Třída",
  6: "Metoda",
  7: "Vlastnost",
  8: "Pole",
  9: "Konstruktor",
  10: "Enum",
  11: "Rozhraní",
  12: "Funkce",
  13: "Proměnná",
  14: "Konstanta",
  22: "Enum hodnota",
  23: "Struktura",
};

export function symbolKindName(kind: number): string {
  return KIND_NAMES[kind] ?? "Symbol";
}
