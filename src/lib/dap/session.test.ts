import { describe, it, expect } from "vitest";
import {
  parseThreads,
  parseStackFrames,
  parseScopes,
  parseVariables,
} from "./session";

describe("DAP response parsing", () => {
  it("parses threads", () => {
    expect(parseThreads({ threads: [{ id: 1, name: "main" }] })).toEqual([
      { id: 1, name: "main" },
    ]);
  });

  it("parses stack frames and converts file URIs to paths", () => {
    const frames = parseStackFrames({
      stackFrames: [
        { id: 3, name: "foo", source: { path: "/proj/a.py" }, line: 4, column: 2 },
        { id: 4, name: "bar", source: { path: "file:///proj/b.py" }, line: 1, column: 0 },
        { id: 5, name: "native" },
      ],
    });
    expect(frames[0]).toEqual({ id: 3, name: "foo", path: "/proj/a.py", line: 4, column: 2 });
    expect(frames[1].path).toBe("/proj/b.py");
    expect(frames[2].path).toBeNull();
  });

  it("parses scopes and variables", () => {
    expect(parseScopes({ scopes: [{ name: "Locals", variablesReference: 9, expensive: false }] }))
      .toEqual([{ name: "Locals", variablesReference: 9, expensive: false }]);
    expect(
      parseVariables({ variables: [{ name: "x", value: "1", type: "int", variablesReference: 0 }] }),
    ).toEqual([{ name: "x", value: "1", type: "int", variablesReference: 0 }]);
  });

  it("is total on missing or malformed bodies", () => {
    expect(parseThreads(null)).toEqual([]);
    expect(parseStackFrames(undefined)).toEqual([]);
    expect(parseScopes({})).toEqual([]);
    expect(parseVariables({ variables: "nope" })).toEqual([]);
  });
});
