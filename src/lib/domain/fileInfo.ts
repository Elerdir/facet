/** Lightweight metadata used to decide how to open a file. */
export interface FileInfo {
  size: number;
  binary: boolean;
  encoding: string;
}

/** Text files larger than this skip expensive whole-document features. */
export const LARGE_TEXT_BYTES = 2 * 1024 * 1024; // 2 MiB

export type FileClass = "binary" | "large-text" | "text";

export function classifyFile(info: FileInfo): FileClass {
  if (info.binary) return "binary";
  if (info.size > LARGE_TEXT_BYTES) return "large-text";
  return "text";
}
