/** Pure parsing + application of AI SEARCH/REPLACE edit blocks across files. */

export interface SearchReplace {
  path: string;
  search: string;
  replace: string;
}

const FENCE_OPEN = "<<<<<<< SEARCH";
const FENCE_MID = "=======";
const FENCE_CLOSE = ">>>>>>> REPLACE";

/**
 * Parse blocks of the form:
 *
 *   path/to/file.ts
 *   <<<<<<< SEARCH
 *   old
 *   =======
 *   new
 *   >>>>>>> REPLACE
 *
 * The path is the last non-empty line before the SEARCH marker. Tolerates code
 * fences and prose around the blocks.
 */
export function parseSearchReplaceBlocks(text: string): SearchReplace[] {
  const lines = text.split("\n");
  const edits: SearchReplace[] = [];
  let i = 0;
  let lastPath = "";

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === FENCE_OPEN) {
      const search: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== FENCE_MID) search.push(lines[i++]);
      i++; // skip =======
      const replace: string[] = [];
      while (i < lines.length && lines[i].trim() !== FENCE_CLOSE) replace.push(lines[i++]);
      i++; // skip >>>>>>> REPLACE
      if (lastPath !== "") {
        edits.push({ path: lastPath, search: search.join("\n"), replace: replace.join("\n") });
      }
      continue;
    }
    const trimmed = line.trim();
    // Remember a plausible path line (ignore fences / prose).
    if (trimmed !== "" && !trimmed.startsWith("```") && !trimmed.startsWith("#")) {
      lastPath = trimmed.replace(/^[`*]+|[`*:]+$/g, "").trim();
    }
    i++;
  }
  return edits;
}

export interface FileEditResult {
  path: string;
  before: string;
  after: string;
  /** True when at least one block applied; false means nothing matched. */
  ok: boolean;
}

/**
 * Apply the edits to the given file contents. `files` maps path -> content;
 * unknown paths and non-matching searches are reported as `ok: false`.
 */
export function applyFileEdits(
  files: Map<string, string>,
  edits: SearchReplace[],
): FileEditResult[] {
  const byPath = new Map<string, SearchReplace[]>();
  for (const e of edits) {
    const arr = byPath.get(e.path) ?? [];
    arr.push(e);
    byPath.set(e.path, arr);
  }

  const results: FileEditResult[] = [];
  for (const [path, group] of byPath) {
    const before = files.get(path);
    if (before === undefined) {
      results.push({ path, before: "", after: "", ok: false });
      continue;
    }
    let content = before;
    let any = false;
    for (const e of group) {
      if (e.search === "") {
        // Empty search → append (rare; treat as no-op to stay safe).
        continue;
      }
      const idx = content.indexOf(e.search);
      if (idx !== -1) {
        content = content.slice(0, idx) + e.replace + content.slice(idx + e.search.length);
        any = true;
      }
    }
    results.push({ path, before, after: content, ok: any });
  }
  return results;
}
