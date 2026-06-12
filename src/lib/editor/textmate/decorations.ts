import type { ThemedToken } from "shiki";

/** A resolved styling span over an absolute document range. */
export interface TokenStyle {
  from: number;
  to: number;
  color?: string;
  italic: boolean;
  bold: boolean;
  underline: boolean;
}

// Shiki FontStyle bitmask.
const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;

/**
 * Flatten Shiki's per-line tokens into absolute-range style spans.
 *
 * Shiki token `offset` is absolute within the tokenized source, so spans map
 * directly onto CodeMirror document positions. Empty tokens are dropped.
 * Pure and unit-testable.
 */
export function tokensToStyles(lines: ThemedToken[][]): TokenStyle[] {
  const out: TokenStyle[] = [];
  for (const line of lines) {
    for (const token of line) {
      if (token.content.length === 0) continue;
      const fontStyle = token.fontStyle ?? 0;
      out.push({
        from: token.offset,
        to: token.offset + token.content.length,
        color: token.color,
        italic: (fontStyle & ITALIC) !== 0,
        bold: (fontStyle & BOLD) !== 0,
        underline: (fontStyle & UNDERLINE) !== 0,
      });
    }
  }
  return out;
}

/** Build the inline CSS for a token style, or "" when there is nothing to apply. */
export function styleToCss(style: TokenStyle): string {
  let css = "";
  if (style.color) css += `color:${style.color};`;
  if (style.italic) css += "font-style:italic;";
  if (style.bold) css += "font-weight:bold;";
  if (style.underline) css += "text-decoration:underline;";
  return css;
}
