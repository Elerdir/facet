/** Pure parsing of LSP documentSymbol responses into a uniform tree. */

import { pathFromFileUri } from "../domain/paths";

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

export interface FlatSymbol {
  name: string;
  kind: number;
  /** 0-based line of the symbol. */
  line: number;
  /** Nesting depth (0 = top level), for indenting the picker. */
  depth: number;
}

/** Depth-first flatten of the symbol tree for a "go to symbol" picker. */
export function flattenSymbols(symbols: DocSymbol[], depth = 0): FlatSymbol[] {
  const out: FlatSymbol[] = [];
  for (const s of symbols) {
    out.push({ name: s.name, kind: s.kind, line: s.line, depth });
    out.push(...flattenSymbols(s.children, depth + 1));
  }
  return out;
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

/** A symbol from a `workspace/symbol` result (across the whole project). */
export interface WorkspaceSymbol {
  name: string;
  kind: number;
  /** Local filesystem path of the symbol's file. */
  path: string;
  /** 0-based line. */
  line: number;
  container?: string;
}

/** Parse a `workspace/symbol` result (array of SymbolInformation). */
export function parseWorkspaceSymbols(res: unknown): WorkspaceSymbol[] {
  if (!Array.isArray(res)) return [];
  const out: WorkspaceSymbol[] = [];
  for (const raw of res) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const loc = o.location as
      | { uri?: string; range?: { start?: { line?: number } } }
      | undefined;
    const uri = typeof loc?.uri === "string" ? loc.uri : undefined;
    if (!uri || typeof o.name !== "string") continue;
    out.push({
      name: o.name,
      kind: typeof o.kind === "number" ? o.kind : 0,
      path: pathFromFileUri(uri),
      line: loc?.range?.start?.line ?? 0,
      container: typeof o.containerName === "string" ? o.containerName : undefined,
    });
  }
  return out;
}
