/** Pure parsing of `@path` file mentions from a chat message. */

/** Extract unique `@path` mentions (paths with letters, digits, /._-). */
export function extractMentions(text: string): string[] {
  const out: string[] = [];
  const re = /@([\w./\\-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = m[1].replace(/[.\\/]+$/, ""); // trim trailing separators/dots
    if (path !== "" && !out.includes(path)) out.push(path);
  }
  return out;
}
