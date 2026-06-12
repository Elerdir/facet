/** Persisted, never-saved ("untitled") buffer — survives restart until closed. */
export interface SessionBuffer {
  name: string;
  content: string;
}

export function serializeSession(items: SessionBuffer[]): string {
  return JSON.stringify({ untitled: items }, null, 2);
}

/** Parse session JSON, dropping malformed entries. Pure and defensive. */
export function parseSession(raw: string): SessionBuffer[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data === "object" && data !== null) {
      const list = (data as Record<string, unknown>).untitled;
      if (Array.isArray(list)) {
        return list
          .filter(
            (b): b is { name: unknown; content: unknown } =>
              typeof b === "object" && b !== null,
          )
          .filter((b) => typeof b.name === "string" && typeof b.content === "string")
          .map((b) => ({ name: b.name as string, content: b.content as string }));
      }
    }
  } catch {
    // fall through to empty
  }
  return [];
}
