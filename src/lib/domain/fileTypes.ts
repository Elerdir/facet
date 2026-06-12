import { extension, basename } from "./paths";

/** A user/built-in rule mapping file extensions to a TextMate language id. */
export interface FileTypeRule {
  extensions: string[];
  language: string;
}

/**
 * Built-in extension -> TextMate language map for file types not covered by
 * the fast Lezer path (see editor/languages.ts). Languages are Shiki/TextMate
 * grammar ids, loaded on demand.
 */
const BUILTIN: FileTypeRule[] = [
  { extensions: ["toml"], language: "toml" },
  { extensions: ["yaml", "yml"], language: "yaml" },
  { extensions: ["go"], language: "go" },
  { extensions: ["java"], language: "java" },
  { extensions: ["kt", "kts"], language: "kotlin" },
  { extensions: ["c", "h"], language: "c" },
  { extensions: ["cpp", "cc", "cxx", "hpp", "hh"], language: "cpp" },
  { extensions: ["cs"], language: "csharp" },
  { extensions: ["php"], language: "php" },
  { extensions: ["rb"], language: "ruby" },
  { extensions: ["swift"], language: "swift" },
  { extensions: ["sh", "bash", "zsh"], language: "bash" },
  { extensions: ["ps1", "psm1"], language: "powershell" },
  { extensions: ["sql"], language: "sql" },
  { extensions: ["xml", "svg", "xsl"], language: "xml" },
  { extensions: ["ini", "conf", "cfg"], language: "ini" },
  { extensions: ["lua"], language: "lua" },
  { extensions: ["r"], language: "r" },
  { extensions: ["dart"], language: "dart" },
  { extensions: ["scala"], language: "scala" },
  { extensions: ["pl", "pm"], language: "perl" },
  { extensions: ["graphql", "gql"], language: "graphql" },
  { extensions: ["proto"], language: "proto" },
  { extensions: ["tf", "hcl"], language: "hcl" },
  { extensions: ["zig"], language: "zig" },
  { extensions: ["jl"], language: "julia" },
  { extensions: ["ex", "exs"], language: "elixir" },
  { extensions: ["clj", "cljs"], language: "clojure" },
  { extensions: ["hs"], language: "haskell" },
];

/** Whole-filename matches for files that have no meaningful extension. */
const FILENAMES: Record<string, string> = {
  dockerfile: "docker",
  makefile: "make",
  "cmakelists.txt": "cmake",
};

/**
 * Resolve a TextMate language id for a file name. User rules take precedence
 * over built-ins, enabling custom templates. Returns null when nothing matches.
 */
export function resolveLanguageId(
  name: string,
  userRules: FileTypeRule[] = [],
): string | null {
  const base = basename(name).toLowerCase();
  if (FILENAMES[base]) return FILENAMES[base];

  const ext = extension(name);
  if (!ext) return null;
  for (const rule of userRules) if (rule.extensions.includes(ext)) return rule.language;
  for (const rule of BUILTIN) if (rule.extensions.includes(ext)) return rule.language;
  return null;
}
