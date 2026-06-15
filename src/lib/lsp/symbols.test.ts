import { describe, it, expect } from "vitest";
import { parseDocumentSymbols, symbolKindName } from "./symbols";

describe("parseDocumentSymbols", () => {
  it("parses hierarchical DocumentSymbol with children", () => {
    const res = [
      {
        name: "MyClass",
        kind: 5,
        range: { start: { line: 2, character: 0 }, end: { line: 9, character: 0 } },
        selectionRange: { start: { line: 2, character: 6 } },
        children: [
          {
            name: "method",
            kind: 6,
            selectionRange: { start: { line: 4, character: 2 } },
            children: [],
          },
        ],
      },
    ];
    const syms = parseDocumentSymbols(res);
    expect(syms).toHaveLength(1);
    expect(syms[0]).toMatchObject({ name: "MyClass", kind: 5, line: 2 });
    expect(syms[0].children[0]).toMatchObject({ name: "method", kind: 6, line: 4 });
  });

  it("parses flat SymbolInformation (via location)", () => {
    const res = [
      { name: "foo", kind: 12, location: { range: { start: { line: 7, character: 0 } } } },
    ];
    const syms = parseDocumentSymbols(res);
    expect(syms[0]).toMatchObject({ name: "foo", kind: 12, line: 7 });
    expect(syms[0].children).toEqual([]);
  });

  it("returns [] for null / non-array", () => {
    expect(parseDocumentSymbols(null)).toEqual([]);
    expect(parseDocumentSymbols({})).toEqual([]);
  });
});

describe("symbolKindName", () => {
  it("names common kinds and falls back", () => {
    expect(symbolKindName(5)).toBe("Třída");
    expect(symbolKindName(12)).toBe("Funkce");
    expect(symbolKindName(999)).toBe("Symbol");
  });
});
