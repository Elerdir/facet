/**
 * Port for running an external formatter / import organizer: feed `content` to
 * the program's stdin, return its stdout. Production spawns the process via
 * Rust; tests use a fake.
 */
export interface FormatterPort {
  run(program: string, args: string[], content: string): Promise<string>;
}
