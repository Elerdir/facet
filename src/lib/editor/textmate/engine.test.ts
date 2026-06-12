// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getHighlighter, ensureLanguage, DEFAULT_THEME } from "./engine";
import { tokensToStyles } from "./decorations";

describe("textmate engine (Shiki)", () => {
  it("loads and tokenizes a language outside the Lezer set", async () => {
    expect(await ensureLanguage("toml")).toBe(true);
    const hl = await getHighlighter();

    const code = '# comment\ntitle = "Facet"\n';
    const lines = hl.codeToTokensBase(code, { lang: "toml", theme: DEFAULT_THEME });
    const styles = tokensToStyles(lines);

    expect(styles.length).toBeGreaterThan(0);
    // Offsets are absolute: slicing the source by a span has the right length.
    for (const s of styles) {
      expect(code.slice(s.from, s.to).length).toBe(s.to - s.from);
    }
    expect(styles.some((s) => !!s.color)).toBe(true);
  }, 30000);

  it("returns false for an unknown language instead of throwing", async () => {
    expect(await ensureLanguage("definitely-not-a-real-language")).toBe(false);
  }, 30000);
});
