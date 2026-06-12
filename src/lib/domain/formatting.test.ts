import { describe, it, expect } from "vitest";
import { resolveFormatter } from "./formatting";

describe("resolveFormatter (format)", () => {
  it("uses Prettier for web languages", () => {
    expect(resolveFormatter("a.ts", "format")).toEqual({
      kind: "prettier",
      parser: "typescript",
    });
    expect(resolveFormatter("a.css", "format")).toEqual({
      kind: "prettier",
      parser: "css",
    });
    expect(resolveFormatter("a.md", "format")).toEqual({
      kind: "prettier",
      parser: "markdown",
    });
  });

  it("uses an external formatter for non-web languages", () => {
    const spec = resolveFormatter("main.rs", "format");
    expect(spec.kind).toBe("external");
    if (spec.kind === "external") expect(spec.program).toBe("rustfmt");
  });

  it("returns none for unknown extensions", () => {
    expect(resolveFormatter("data.xyz", "format")).toEqual({ kind: "none" });
  });
});

describe("resolveFormatter (organizeImports)", () => {
  it("uses an external organizer where one exists", () => {
    const spec = resolveFormatter("a.py", "organizeImports");
    expect(spec.kind).toBe("external");
    if (spec.kind === "external") expect(spec.program).toBe("ruff");
  });

  it("returns none where no organizer is configured", () => {
    expect(resolveFormatter("a.ts", "organizeImports")).toEqual({ kind: "none" });
  });
});
