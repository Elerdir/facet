import {
  resolveFormatter,
  type FormatAction,
} from "../domain/formatting";
import { formatWithPrettier } from "../format/prettier";
import type { FormatterPort } from "../ports/formatter";
import type { Buffer } from "../domain/buffer";

/**
 * Runs the resolved formatter for a buffer: Prettier in-process for web
 * languages, an external tool (via the port) otherwise.
 */
export class FormatterService {
  #port: FormatterPort;

  constructor(port: FormatterPort) {
    this.#port = port;
  }

  canFormat(name: string, action: FormatAction): boolean {
    return resolveFormatter(name, action).kind !== "none";
  }

  /** Returns formatted content, or null when unchanged / no formatter. */
  async format(buffer: Buffer, action: FormatAction): Promise<string | null> {
    const spec = resolveFormatter(buffer.name, action);

    let result: string;
    if (spec.kind === "prettier") {
      result = await formatWithPrettier(buffer.content, spec.parser);
    } else if (spec.kind === "external") {
      result = await this.#port.run(spec.program, spec.args, buffer.content);
    } else {
      return null;
    }

    return result === buffer.content ? null : result;
  }
}
