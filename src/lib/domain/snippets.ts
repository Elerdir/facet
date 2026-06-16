/** Code snippets with tab-stops. Pure logic; the editor turns these into
 * CodeMirror snippet completions. Body uses `${1:placeholder}` / `${0}` (final
 * cursor); bare `$1` / `$name` are also accepted and normalized. */

export interface SnippetConfig {
  prefix: string;
  body: string;
  description?: string;
  /** Extensions (without dot) this applies to; empty = all languages. */
  extensions: string[];
}

export const BUILTIN_SNIPPETS: SnippetConfig[] = [
  {
    prefix: "log",
    body: "console.log(${1})$0",
    description: "console.log",
    extensions: ["js", "jsx", "ts", "tsx", "mjs", "cjs"],
  },
  {
    prefix: "fn",
    body: "function ${1:name}(${2}) {\n\t$0\n}",
    description: "funkce",
    extensions: ["js", "ts", "mjs", "cjs"],
  },
  {
    prefix: "forr",
    body: "for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}",
    description: "for cyklus",
    extensions: ["js", "ts", "jsx", "tsx", "mjs", "cjs", "c", "cpp", "rs"],
  },
  { prefix: "todo", body: "// TODO: $0", description: "TODO komentář", extensions: [] },
];

/** Normalize VS Code-style bare `$1` / `$name` tab-stops to CodeMirror `${…}`. */
export function normalizeSnippet(body: string): string {
  return body.replace(/\$(\d+|[A-Za-z_]\w*)/g, "${$1}");
}

/** Snippets available for a file extension (user first, deduped by prefix). */
export function snippetsForExtension(ext: string, user: SnippetConfig[]): SnippetConfig[] {
  const out: SnippetConfig[] = [];
  const seen = new Set<string>();
  for (const s of [...user, ...BUILTIN_SNIPPETS]) {
    if (s.extensions.length > 0 && !s.extensions.includes(ext)) continue;
    if (seen.has(s.prefix)) continue;
    seen.add(s.prefix);
    out.push(s);
  }
  return out;
}

/** Validate and normalize a raw `snippets` setting. */
export function parseSnippets(raw: unknown): SnippetConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: SnippetConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.prefix !== "string" || o.prefix === "" || typeof o.body !== "string") continue;
    const extensions = Array.isArray(o.extensions)
      ? o.extensions
          .filter((e): e is string => typeof e === "string")
          .map((e) => e.replace(/^\./, "").toLowerCase())
      : [];
    out.push({
      prefix: o.prefix,
      body: o.body,
      description: typeof o.description === "string" ? o.description : undefined,
      extensions,
    });
  }
  return out;
}
