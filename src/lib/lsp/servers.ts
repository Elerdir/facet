import { extension } from "../domain/paths";

/** A language server invocation plus the LSP languageId for the file. */
export interface ServerSpec {
  /** Stable key so one process is shared by all files using the same server. */
  serverId: string;
  command: string;
  args: string[];
  languageId: string;
}

const TS = { serverId: "typescript", command: "typescript-language-server", args: ["--stdio"] };

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
};

/** The language server for a file name, or null when none is configured. */
export function serverForName(name: string): ServerSpec | null {
  return BY_EXT[extension(name)] ?? null;
}
