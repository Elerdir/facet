import { extension } from "./paths";

export type FormatAction = "format" | "organizeImports";

/** How a file should be formatted for a given action. */
export type FormatterSpec =
  | { kind: "prettier"; parser: string }
  | { kind: "external"; program: string; args: string[] }
  | { kind: "none" };

/** Web languages formatted in-process by Prettier. */
const PRETTIER_PARSERS: Record<string, string> = {
  js: "babel",
  mjs: "babel",
  cjs: "babel",
  jsx: "babel",
  ts: "typescript",
  mts: "typescript",
  tsx: "typescript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  vue: "vue",
  md: "markdown",
  markdown: "markdown",
  yaml: "yaml",
  yml: "yaml",
};

/** External formatters (used when the tool is installed). */
const EXTERNAL_FORMAT: Record<string, { program: string; args: string[] }> = {
  rs: { program: "rustfmt", args: ["--emit", "stdout"] },
  go: { program: "gofmt", args: [] },
  py: { program: "black", args: ["-q", "-"] },
};

/** External import organizers (remove unused / sort imports). */
const EXTERNAL_ORGANIZE: Record<string, { program: string; args: string[] }> = {
  py: { program: "ruff", args: ["check", "--select", "I,F401", "--fix", "-"] },
  go: { program: "goimports", args: [] },
};

/**
 * Resolve the formatter for a file + action. Pure: the actual execution (in
 * Prettier or an external process) is decided by the caller.
 */
export function resolveFormatter(
  name: string,
  action: FormatAction,
): FormatterSpec {
  const ext = extension(name);

  if (action === "format") {
    const parser = PRETTIER_PARSERS[ext];
    if (parser) return { kind: "prettier", parser };
    const external = EXTERNAL_FORMAT[ext];
    if (external) return { kind: "external", ...external };
    return { kind: "none" };
  }

  const organize = EXTERNAL_ORGANIZE[ext];
  if (organize) return { kind: "external", ...organize };
  return { kind: "none" };
}
