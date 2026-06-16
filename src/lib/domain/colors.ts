/** Find CSS colors in text for the editor's inline color swatches. Pure. */

export interface ColorMatch {
  /** Offset of the color token within the given text. */
  from: number;
  to: number;
  /** The matched string, usable directly as a CSS color. */
  color: string;
}

// Hex (#rgb / #rgba / #rrggbb / #rrggbbaa, longest first) or rgb()/hsl() forms.
const COLOR_RE =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|(?:rgb|hsl)a?\([^)]*\)/g;

export function findColors(text: string): ColorMatch[] {
  const out: ColorMatch[] = [];
  for (const m of text.matchAll(COLOR_RE)) {
    if (m.index === undefined) continue;
    out.push({ from: m.index, to: m.index + m[0].length, color: m[0] });
  }
  return out;
}
