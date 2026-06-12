import { invoke } from "@tauri-apps/api/core";
import type { FormatterPort } from "../ports/formatter";

/** FormatterPort backed by the Rust `run_command_stdio` command. */
export class TauriFormatter implements FormatterPort {
  run(program: string, args: string[], content: string): Promise<string> {
    return invoke<string>("run_command_stdio", { program, args, content });
  }
}
