/** One matching line from a project-wide search (mirrors the Rust struct). */
export interface SearchMatch {
  path: string;
  line: number;
  text: string;
}
