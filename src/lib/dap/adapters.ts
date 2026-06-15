import { extension } from "../domain/paths";

/**
 * A debug adapter invocation. Like `ServerSpec` for LSP: maps a file to the
 * external DAP adapter that can debug it. Adapters must be installed by the
 * user (debugpy, delve, lldb-dap, …) — same model as language servers.
 */
export interface AdapterSpec {
  /** Stable key; one adapter process per session. */
  adapterId: string;
  command: string;
  args: string[];
  /** The `type` field used in the DAP `launch` request. */
  type: string;
}

const DEBUGPY: AdapterSpec = {
  adapterId: "debugpy",
  command: "python",
  args: ["-m", "debugpy.adapter"],
  type: "python",
};

const DELVE: AdapterSpec = {
  adapterId: "delve",
  command: "dlv",
  args: ["dap"],
  type: "go",
};

const LLDB: AdapterSpec = {
  adapterId: "lldb",
  command: "lldb-dap",
  args: [],
  type: "lldb",
};

const BY_EXT: Record<string, AdapterSpec> = {
  py: DEBUGPY,
  go: DELVE,
  rs: LLDB,
  c: LLDB,
  cc: LLDB,
  cpp: LLDB,
  cxx: LLDB,
  h: LLDB,
  hpp: LLDB,
};

/** The debug adapter for a file name, or null when none is configured. */
export function adapterForFile(name: string): AdapterSpec | null {
  return BY_EXT[extension(name)] ?? null;
}

/**
 * Build the `launch` request arguments for an adapter. Generic but reasonable:
 * `program` + `cwd` + `request: "launch"` covers the common case; callers can
 * extend it. `stopOnEntry` lets the panel offer "start and break immediately".
 */
export function launchConfig(
  spec: AdapterSpec,
  program: string,
  cwd: string,
  stopOnEntry = false,
): Record<string, unknown> {
  return {
    request: "launch",
    type: spec.type,
    name: `Spustit ${program}`,
    program,
    cwd,
    stopOnEntry,
    console: "internalConsole",
  };
}
