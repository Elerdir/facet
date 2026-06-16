import { describe, it, expect } from "vitest";
import {
  parseDocumentSymbols,
  symbolKindName,
  symbolTrail,
  flattenSymbols,
  parseWorkspaceSymbols,
} from "./symbols";

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
    expect(syms[0]).toMatchObject({ name: "MyClass", kind: 5, line: 2, endLine: 9 });
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

describe("symbolTrail", () => {
  const tree = parseDocumentSymbols([
    {
      name: "MyClass",
      kind: 5,
      range: { start: { line: 2, character: 0 }, end: { line: 9, character: 0 } },
      children: [
        {
          name: "method",
          kind: 6,
          range: { start: { line: 4, character: 2 }, end: { line: 6, character: 2 } },
          children: [],
        },
      ],
    },
  ]);

  it("returns the outer→inner chain containing a line", () => {
    expect(symbolTrail(tree, 5).map((s) => s.name)).toEqual(["MyClass", "method"]);
    expect(symbolTrail(tree, 8).map((s) => s.name)).toEqual(["MyClass"]);
  });

  it("returns [] when no symbol contains the line", () => {
    expect(symbolTrail(tree, 0)).toEqual([]);
  });
});

describe("flattenSymbols", () => {
  it("flattens depth-first with nesting depth", () => {
    const tree = parseDocumentSymbols([
      {
        name: "A",
        kind: 5,
        range: { start: { line: 0, character: 0 }, end: { line: 9, character: 0 } },
        children: [
          { name: "m", kind: 6, range: { start: { line: 1, character: 0 } }, children: [] },
        ],
      },
      { name: "B", kind: 12, range: { start: { line: 10, character: 0 } }, children: [] },
    ]);
    expect(flattenSymbols(tree)).toEqual([
      { name: "A", kind: 5, line: 0, depth: 0 },
      { name: "m", kind: 6, line: 1, depth: 1 },
      { name: "B", kind: 12, line: 10, depth: 0 },
    ]);
  });
});

describe("parseWorkspaceSymbols", () => {
  it("parses SymbolInformation with location into path + line", () => {
    const syms = parseWorkspaceSymbols([
      {
        name: "doThing",
        kind: 12,
        containerName: "utils",
        location: { uri: "file:///proj/a.ts", range: { start: { line: 9, character: 0 } } },
      },
      { name: "noLoc" }, // dropped: no location
    ]);
    expect(syms).toHaveLength(1);
    expect(syms[0]).toMatchObject({ name: "doThing", kind: 12, path: "/proj/a.ts", line: 9, container: "utils" });
  });

  it("returns [] for non-arrays", () => {
    expect(parseWorkspaceSymbols(null)).toEqual([]);
  });
});

describe("symbolKindName", () => {
  it("names common kinds and falls back", () => {
    expect(symbolKindName(5)).toBe("Třída");
    expect(symbolKindName(12)).toBe("Funkce");
    expect(symbolKindName(999)).toBe("Symbol");
  });
});
