import { describe, it, expect } from "vitest";
import { parseCodeActions } from "./codeActions";

describe("parseCodeActions", () => {
  it("parses a CodeAction carrying a workspace edit", () => {
    const res = [
      {
        title: "Odebrat nepoužitý import",
        kind: "quickfix",
        isPreferred: true,
        edit: {
          changes: {
            "file:///a.ts": [
              { range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } }, newText: "" },
            ],
          },
        },
      },
    ];
    const actions = parseCodeActions(res);
    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe("Odebrat nepoužitý import");
    expect(actions[0].isPreferred).toBe(true);
    expect(actions[0].edit?.changes["file:///a.ts"][0]).toMatchObject({
      startLine: 0,
      endLine: 1,
      newText: "",
    });
  });

  it("parses a bare Command", () => {
    const actions = parseCodeActions([
      { title: "Uspořádat importy", command: "_typescript.organizeImports", arguments: ["a.ts"] },
    ]);
    expect(actions[0]).toMatchObject({
      title: "Uspořádat importy",
      command: { command: "_typescript.organizeImports", arguments: ["a.ts"] },
    });
    expect(actions[0].edit).toBeUndefined();
  });

  it("parses a CodeAction whose work is deferred to a server command", () => {
    const actions = parseCodeActions([
      { title: "Opravit vše", kind: "source.fixAll", command: { command: "fixAll", arguments: [1] } },
    ]);
    expect(actions[0].command).toEqual({ command: "fixAll", arguments: [1] });
  });

  it("skips malformed entries and non-arrays", () => {
    expect(parseCodeActions(null)).toEqual([]);
    expect(parseCodeActions([null, {}, { title: "" }, "x"])).toEqual([]);
  });
});
