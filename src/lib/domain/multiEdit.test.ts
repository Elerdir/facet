import { describe, it, expect } from "vitest";
import { parseSearchReplaceBlocks, applyFileEdits } from "./multiEdit";

const SAMPLE = `Provedu tyto zmeny:

src/a.ts
<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE

src/b.ts
<<<<<<< SEARCH
foo()
=======
bar()
>>>>>>> REPLACE
`;

describe("parseSearchReplaceBlocks", () => {
  it("parses path + search + replace per block", () => {
    const edits = parseSearchReplaceBlocks(SAMPLE);
    expect(edits).toHaveLength(2);
    expect(edits[0]).toEqual({ path: "src/a.ts", search: "const x = 1;", replace: "const x = 2;" });
    expect(edits[1]).toEqual({ path: "src/b.ts", search: "foo()", replace: "bar()" });
  });

  it("ignores prose and returns [] when there are no blocks", () => {
    expect(parseSearchReplaceBlocks("Žádné změny nejsou potřeba.")).toEqual([]);
  });

  it("supports multiple blocks for the same file", () => {
    const text = `a.ts
<<<<<<< SEARCH
1
=======
one
>>>>>>> REPLACE
a.ts
<<<<<<< SEARCH
2
=======
two
>>>>>>> REPLACE`;
    expect(parseSearchReplaceBlocks(text)).toHaveLength(2);
  });
});

describe("applyFileEdits", () => {
  it("applies matching edits and reports per-file results", () => {
    const files = new Map([
      ["src/a.ts", "const x = 1;\n"],
      ["src/b.ts", "foo()\n"],
    ]);
    const results = applyFileEdits(files, parseSearchReplaceBlocks(SAMPLE));
    expect(results.find((r) => r.path === "src/a.ts")).toMatchObject({
      after: "const x = 2;\n",
      ok: true,
    });
    expect(results.find((r) => r.path === "src/b.ts")?.after).toBe("bar()\n");
  });

  it("flags unknown paths and non-matching searches as not ok", () => {
    const files = new Map([["a.ts", "hello"]]);
    const edits = [
      { path: "a.ts", search: "nope", replace: "x" },
      { path: "missing.ts", search: "a", replace: "b" },
    ];
    const results = applyFileEdits(files, edits);
    expect(results.find((r) => r.path === "a.ts")?.ok).toBe(false);
    expect(results.find((r) => r.path === "missing.ts")?.ok).toBe(false);
  });
});
