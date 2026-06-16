import { describe, it, expect } from "vitest";
import { normalizeSnippet, snippetsForExtension, parseSnippets } from "./snippets";

describe("normalizeSnippet", () => {
  it("wraps bare tab-stops and leaves braced ones intact", () => {
    expect(normalizeSnippet("console.log($1)$0")).toBe("console.log(${1})${0}");
    expect(normalizeSnippet("${1:name} and $2")).toBe("${1:name} and ${2}");
  });
});

describe("snippetsForExtension", () => {
  it("includes built-ins for matching extensions and global ones", () => {
    const ts = snippetsForExtension("ts", []);
    expect(ts.some((s) => s.prefix === "log")).toBe(true);
    expect(ts.some((s) => s.prefix === "todo")).toBe(true); // global (no ext)
    const txt = snippetsForExtension("txt", []);
    expect(txt.some((s) => s.prefix === "log")).toBe(false);
    expect(txt.some((s) => s.prefix === "todo")).toBe(true);
  });

  it("lets a user snippet override a built-in by prefix", () => {
    const user = [{ prefix: "log", body: "println($1)", extensions: ["ts"] }];
    const ts = snippetsForExtension("ts", user);
    expect(ts.filter((s) => s.prefix === "log")).toHaveLength(1);
    expect(ts.find((s) => s.prefix === "log")!.body).toBe("println($1)");
  });
});

describe("parseSnippets", () => {
  it("keeps valid entries and normalizes extensions", () => {
    expect(
      parseSnippets([
        { prefix: "p", body: "x", extensions: [".TS", "js"] },
        { prefix: "", body: "y" },
        "nope",
      ]),
    ).toEqual([{ prefix: "p", body: "x", description: undefined, extensions: ["ts", "js"] }]);
  });
});
