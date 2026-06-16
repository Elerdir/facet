/** Pure helpers for status-bar text info: line endings and indentation. */

export type Eol = "lf" | "crlf";

export function detectEol(text: string): Eol {
  return text.includes("\r\n") ? "crlf" : "lf";
}

/** Normalize all line endings to the target. */
export function convertEol(text: string, eol: Eol): string {
  const lf = text.replace(/\r\n?/g, "\n");
  return eol === "crlf" ? lf.replace(/\n/g, "\r\n") : lf;
}

export interface IndentInfo {
  kind: "tabs" | "spaces";
  /** For spaces, the detected unit (2/4/…); for tabs, a nominal display width. */
  size: number;
}

/** Heuristically detect a file's indentation from its leading whitespace. */
export function detectIndent(text: string): IndentInfo {
  let tabLines = 0;
  let spaceLines = 0;
  const sizes = new Set<number>();
  for (const line of text.split("\n")) {
    const m = /^([ \t]+)\S/.exec(line);
    if (!m) continue;
    const ws = m[1];
    if (ws[0] === "\t") tabLines++;
    else {
      spaceLines++;
      sizes.add(ws.length);
    }
  }
  if (tabLines > spaceLines) return { kind: "tabs", size: 4 };
  const positive = [...sizes].filter((n) => n > 0);
  return { kind: "spaces", size: positive.length ? Math.min(...positive) : 4 };
}

/** Replace each line's leading tabs with `size` spaces. */
export function tabsToSpaces(text: string, size: number): string {
  return text
    .split("\n")
    .map((line) => {
      const m = /^\t+/.exec(line);
      return m ? " ".repeat(m[0].length * size) + line.slice(m[0].length) : line;
    })
    .join("\n");
}

/** Replace each line's leading run of `size` spaces with a tab. */
export function spacesToTabs(text: string, size: number): string {
  return text
    .split("\n")
    .map((line) => {
      const m = /^ +/.exec(line);
      if (!m) return line;
      const n = m[0].length;
      return "\t".repeat(Math.floor(n / size)) + " ".repeat(n % size) + line.slice(n);
    })
    .join("\n");
}
