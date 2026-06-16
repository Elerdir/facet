/** Pure parsing of LSP `textDocument/codeAction` responses. */

import { parseWorkspaceEdit, type LspWorkspaceEdit } from "./edits";

export interface CodeActionItem {
  title: string;
  kind?: string;
  /** Direct edit to apply, when the action carries one. */
  edit?: LspWorkspaceEdit;
  /** Server command to execute (some actions defer the edit to the server). */
  command?: { command: string; arguments: unknown[] };
  isPreferred?: boolean;
}

/**
 * Parse a code-action result. Items are either a `Command` (has a string
 * `command`) or a `CodeAction` (has a `title`, optional `edit`, optional nested
 * `command`). Malformed entries are skipped.
 */
export function parseCodeActions(res: unknown): CodeActionItem[] {
  if (!Array.isArray(res)) return [];
  const out: CodeActionItem[] = [];
  for (const raw of res) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "";
    if (title === "") continue;

    // A bare Command: { title, command: string, arguments }.
    if (typeof o.command === "string") {
      out.push({
        title,
        command: { command: o.command, arguments: Array.isArray(o.arguments) ? o.arguments : [] },
      });
      continue;
    }

    // A CodeAction: { title, kind?, edit?, command?: Command, isPreferred? }.
    const cmd = o.command as Record<string, unknown> | undefined;
    out.push({
      title,
      kind: typeof o.kind === "string" ? o.kind : undefined,
      edit: o.edit ? (parseWorkspaceEdit(o.edit) ?? undefined) : undefined,
      command:
        cmd && typeof cmd.command === "string"
          ? { command: cmd.command, arguments: Array.isArray(cmd.arguments) ? cmd.arguments : [] }
          : undefined,
      isPreferred: o.isPreferred === true,
    });
  }
  return out;
}
