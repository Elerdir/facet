import { extension } from "../domain/paths";

/** A language server invocation plus the LSP languageId for the file. */
export interface ServerSpec {
  /** Stable key so one process is shared by all files using the same server. */
  serverId: string;
  command: string;
  args: string[];
  languageId: string;
}

/** A user-defined server mapping (from settings), overriding the built-ins. */
export interface LspServerConfig {
  /** File extensions (without the dot) this server handles. */
  extensions: string[];
  serverId: string;
  command: string;
  args: string[];
  languageId: string;
}

const TS = { serverId: "typescript", command: "typescript-language-server", args: ["--stdio"] };
const CLANGD = { serverId: "clangd", command: "clangd", args: [] };
const VSCODE_CSS = { serverId: "css", command: "vscode-css-language-server", args: ["--stdio"] };

const BY_EXT: Record<string, ServerSpec> = {
  ts: { ...TS, languageId: "typescript" },
  mts: { ...TS, languageId: "typescript" },
  cts: { ...TS, languageId: "typescript" },
  tsx: { ...TS, languageId: "typescriptreact" },
  js: { ...TS, languageId: "javascript" },
  mjs: { ...TS, languageId: "javascript" },
  cjs: { ...TS, languageId: "javascript" },
  jsx: { ...TS, languageId: "javascriptreact" },
  rs: { serverId: "rust", command: "rust-analyzer", args: [], languageId: "rust" },
  py: { serverId: "python", command: "pyright-langserver", args: ["--stdio"], languageId: "python" },
  go: { serverId: "go", command: "gopls", args: [], languageId: "go" },
  c: { ...CLANGD, languageId: "c" },
  h: { ...CLANGD, languageId: "c" },
  cpp: { ...CLANGD, languageId: "cpp" },
  cc: { ...CLANGD, languageId: "cpp" },
  cxx: { ...CLANGD, languageId: "cpp" },
  hpp: { ...CLANGD, languageId: "cpp" },
  lua: { serverId: "lua", command: "lua-language-server", args: [], languageId: "lua" },
  sh: { serverId: "bash", command: "bash-language-server", args: ["start"], languageId: "shellscript" },
  bash: { serverId: "bash", command: "bash-language-server", args: ["start"], languageId: "shellscript" },
  json: { serverId: "json", command: "vscode-json-language-server", args: ["--stdio"], languageId: "json" },
  jsonc: { serverId: "json", command: "vscode-json-language-server", args: ["--stdio"], languageId: "jsonc" },
  html: { serverId: "html", command: "vscode-html-language-server", args: ["--stdio"], languageId: "html" },
  css: { ...VSCODE_CSS, languageId: "css" },
  scss: { ...VSCODE_CSS, languageId: "scss" },
  less: { ...VSCODE_CSS, languageId: "less" },
  yaml: { serverId: "yaml", command: "yaml-language-server", args: ["--stdio"], languageId: "yaml" },
  yml: { serverId: "yaml", command: "yaml-language-server", args: ["--stdio"], languageId: "yaml" },
};

/** The built-in language server for a file name, or null when none is configured. */
export function serverForName(name: string): ServerSpec | null {
  return BY_EXT[extension(name)] ?? null;
}

/** A user-configured server for a file name (overrides built-ins), or null. */
export function userServerForName(
  name: string,
  configs: LspServerConfig[],
): ServerSpec | null {
  const ext = extension(name);
  const cfg = configs.find((c) =>
    c.extensions.some((e) => e.replace(/^\./, "").toLowerCase() === ext),
  );
  if (!cfg || cfg.command.trim() === "") return null;
  return {
    serverId: cfg.serverId,
    command: cfg.command,
    args: cfg.args,
    languageId: cfg.languageId,
  };
}

/** Validate and normalize a raw `lspServers` setting into clean configs. */
export function parseLspServers(raw: unknown): LspServerConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: LspServerConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const extensions = Array.isArray(o.extensions)
      ? o.extensions.filter((e): e is string => typeof e === "string")
      : [];
    const args = Array.isArray(o.args)
      ? o.args.filter((a): a is string => typeof a === "string")
      : [];
    if (
      extensions.length === 0 ||
      typeof o.command !== "string" ||
      o.command.trim() === ""
    ) {
      continue;
    }
    out.push({
      extensions,
      serverId: typeof o.serverId === "string" && o.serverId !== "" ? o.serverId : o.command,
      command: o.command,
      args,
      languageId: typeof o.languageId === "string" ? o.languageId : "plaintext",
    });
  }
  return out;
}
