/** Pure parsing of a single-file unified diff into stageable hunks. */

export interface DiffHunk {
  id: number;
  /** The `@@ … @@` header line of the hunk. */
  header: string;
  /** Full hunk text (header + body lines), newline-terminated. */
  text: string;
}

export interface ParsedFileDiff {
  /** Everything before the first hunk (`diff --git`, `---`, `+++`, …). */
  fileHeader: string;
  hunks: DiffHunk[];
}

/** Parse `git diff -- <file>` output. Returns null when there are no hunks. */
export function parseUnifiedDiff(patch: string): ParsedFileDiff | null {
  if (patch.trim() === "") return null;
  const lines = patch.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  let i = 0;
  const headerLines: string[] = [];
  while (i < lines.length && !lines[i].startsWith("@@")) {
    headerLines.push(lines[i]);
    i++;
  }
  if (i >= lines.length) return null; // header but no hunks

  const hunks: DiffHunk[] = [];
  let id = 0;
  while (i < lines.length) {
    const start = i;
    const header = lines[i];
    i++;
    while (i < lines.length && !lines[i].startsWith("@@")) i++;
    const body = lines.slice(start, i);
    hunks.push({ id: id++, header, text: `${body.join("\n")}\n` });
  }
  return { fileHeader: `${headerLines.join("\n")}\n`, hunks };
}

/** Rebuild a patch from the file header plus the chosen hunks. */
export function buildPatch(fileHeader: string, hunks: DiffHunk[]): string {
  return fileHeader + hunks.map((h) => h.text).join("");
}

export type HunkLineKind = "add" | "del" | "context" | "meta";

/** Classify a hunk body line for colored display. */
export function hunkLineKind(line: string): HunkLineKind {
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  if (line.startsWith("@@") || line.startsWith("\\")) return "meta";
  return "context";
}
