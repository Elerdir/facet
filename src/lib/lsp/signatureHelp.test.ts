import { describe, it, expect } from "vitest";
import { parseSignatureHelp } from "./signatureHelp";

describe("parseSignatureHelp", () => {
  it("parses signatures with string parameter labels", () => {
    const help = parseSignatureHelp({
      signatures: [
        { label: "fn(a: number, b: string)", parameters: [{ label: "a: number" }, { label: "b: string" }] },
      ],
      activeSignature: 0,
      activeParameter: 1,
    });
    expect(help).not.toBeNull();
    expect(help!.signatures[0].label).toBe("fn(a: number, b: string)");
    expect(help!.signatures[0].parameters.map((p) => p.label)).toEqual(["a: number", "b: string"]);
    expect(help!.activeParameter).toBe(1);
  });

  it("resolves [start,end] parameter labels against the signature", () => {
    const help = parseSignatureHelp({
      signatures: [{ label: "fn(a, b)", parameters: [{ label: [3, 4] }, { label: [6, 7] }] }],
    });
    expect(help!.signatures[0].parameters.map((p) => p.label)).toEqual(["a", "b"]);
    expect(help!.activeSignature).toBe(0);
    expect(help!.activeParameter).toBe(0);
  });

  it("returns null for empty or malformed input", () => {
    expect(parseSignatureHelp(null)).toBeNull();
    expect(parseSignatureHelp({ signatures: [] })).toBeNull();
    expect(parseSignatureHelp({})).toBeNull();
  });
});
