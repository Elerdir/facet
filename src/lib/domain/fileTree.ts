/**
 * Directory-listing model and pure ordering logic for the file explorer.
 * The reactive expansion/loading state lives in the application store; this
 * module stays pure and testable.
 */
export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
}

/**
 * Order entries the way an explorer should: directories first, then files,
 * each group sorted case-insensitively with natural numeric ordering
 * ("file2" before "file10").
 */
export function sortEntries(entries: readonly TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}
