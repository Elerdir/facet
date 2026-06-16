/** Persisted session: unsaved buffers, the opened folder, open files and the
 * active tab — restored on the next start (hot exit + session restore). */

export interface SessionBuffer {
  name: string;
  content: string;
}

export interface SessionData {
  /** Never-saved ("untitled") buffers — survive until closed. */
  untitled: SessionBuffer[];
  /** Primary folder (legacy single-root field). */
  folder: string | null;
  /** All workspace folders (multi-root); falls back to [folder]. */
  folders: string[];
  files: string[];
  activePath: string | null;
}

export const EMPTY_SESSION: SessionData = {
  untitled: [],
  folder: null,
  folders: [],
  files: [],
  activePath: null,
};

export function serializeSession(data: SessionData): string {
  return JSON.stringify(data, null, 2);
}

/** Parse session JSON defensively; tolerates the legacy `{untitled}` format. */
export function parseSession(raw: string): SessionData {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return { ...EMPTY_SESSION };
    const r = data as Record<string, unknown>;

    const untitled = Array.isArray(r.untitled)
      ? r.untitled
          .filter(
            (b): b is { name: unknown; content: unknown } =>
              typeof b === "object" && b !== null,
          )
          .filter((b) => typeof b.name === "string" && typeof b.content === "string")
          .map((b) => ({ name: b.name as string, content: b.content as string }))
      : [];

    const folder = typeof r.folder === "string" && r.folder !== "" ? r.folder : null;
    const folders = Array.isArray(r.folders)
      ? r.folders.filter((f): f is string => typeof f === "string" && f !== "")
      : folder
        ? [folder]
        : [];

    return {
      untitled,
      folder,
      folders,
      files: Array.isArray(r.files)
        ? r.files.filter((f): f is string => typeof f === "string" && f !== "")
        : [],
      activePath:
        typeof r.activePath === "string" && r.activePath !== "" ? r.activePath : null,
    };
  } catch {
    return { ...EMPTY_SESSION };
  }
}
