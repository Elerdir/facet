/** Markdown-style wrap markers for the basic text-format actions. */

export type TextFormatKind = "bold" | "italic" | "underline" | "strikethrough" | "code";

export const FORMAT_MARKERS: Record<TextFormatKind, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["<u>", "</u>"],
  strikethrough: ["~~", "~~"],
  code: ["`", "`"],
};

/** Wrap a piece of text with the markers for the given format. */
export function wrapText(kind: TextFormatKind, text: string): string {
  const [pre, post] = FORMAT_MARKERS[kind];
  return `${pre}${text}${post}`;
}
