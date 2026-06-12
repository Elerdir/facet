import { describe, it, expect } from "vitest";
import type { ThemedToken } from "shiki";
import { tokensToStyles, styleToCss } from "./decorations";

function tok(content: string, offset: number, color: string, fontStyle = 0): ThemedToken {
  return { content, offset, color, fontStyle } as ThemedToken;
}

describe("tokensToStyles", () => {
  it("maps token offsets to absolute ranges", () => {
    const styles = tokensToStyles([[tok("foo", 0, "#fff"), tok("bar", 3, "#000")]]);
    expect(styles).toHaveLength(2);
    expect(styles[0]).toMatchObject({ from: 0, to: 3, color: "#fff" });
    expect(styles[1]).toMatchObject({ from: 3, to: 6, color: "#000" });
  });

  it("decodes the fontStyle bitmask", () => {
    const [s] = tokensToStyles([[tok("x", 0, "#fff", 1 | 2)]]); // italic + bold
    expect(s.italic).toBe(true);
    expect(s.bold).toBe(true);
    expect(s.underline).toBe(false);
  });

  it("drops empty tokens", () => {
    expect(tokensToStyles([[tok("", 0, "#fff")]])).toHaveLength(0);
  });

  it("keeps tokens ordered by start position", () => {
    const styles = tokensToStyles([
      [tok("a", 0, "#111")],
      [tok("b", 2, "#222")],
    ]);
    expect(styles.map((s) => s.from)).toEqual([0, 2]);
  });
});

describe("styleToCss", () => {
  it("emits colour and font styles", () => {
    const css = styleToCss({ from: 0, to: 1, color: "#abc", italic: true, bold: true, underline: false });
    expect(css).toContain("color:#abc;");
    expect(css).toContain("font-style:italic;");
    expect(css).toContain("font-weight:bold;");
  });

  it("is empty when there is nothing to style", () => {
    expect(styleToCss({ from: 0, to: 1, italic: false, bold: false, underline: false })).toBe("");
  });
});
