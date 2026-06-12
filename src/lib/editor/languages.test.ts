import { describe, it, expect } from "vitest";
import { hasLezerLanguage, loadLanguage } from "./languages";

describe("lezer languages", () => {
  it("knows the common extensions", () => {
    expect(hasLezerLanguage("main.rs")).toBe(true);
    expect(hasLezerLanguage("app.ts")).toBe(true);
    expect(hasLezerLanguage("README.md")).toBe(true);
    expect(hasLezerLanguage("data.json")).toBe(true);
  });

  it("loads a language extension lazily", async () => {
    const ext = await loadLanguage("app.ts");
    expect(ext).not.toBeNull();
  });

  it("returns null / false for unknown or extensionless files", () => {
    expect(hasLezerLanguage("Makefile")).toBe(false);
    expect(hasLezerLanguage(".gitignore")).toBe(false);
    expect(loadLanguage("data.unknownext")).toBeNull();
  });
});
