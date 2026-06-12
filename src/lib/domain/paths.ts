/**
 * Pure path helpers that work on both Windows (`\`) and POSIX (`/`) separators.
 * Kept framework-free so they are trivially unit-testable.
 */

/** Convert all backslashes to forward slashes. */
export function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Last path segment (file or folder name). */
export function basename(p: string): string {
  const n = normalize(p).replace(/\/+$/, "");
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
}

/** Parent directory, or "" when there is no parent. */
export function dirname(p: string): string {
  const n = normalize(p).replace(/\/+$/, "");
  const i = n.lastIndexOf("/");
  if (i < 0) return "";
  if (i === 0) return "/";
  return n.slice(0, i);
}

/**
 * Lower-cased file extension without the dot, or "" when there is none.
 * Leading-dot files (".gitignore") are treated as having no extension.
 */
export function extension(nameOrPath: string): string {
  const b = basename(nameOrPath);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i + 1).toLowerCase() : "";
}

/** Path relative to `root`, or the original path when it is not under root. */
export function relativeTo(root: string, path: string): string {
  const r = normalize(root).replace(/\/+$/, "");
  const p = normalize(path);
  return p.startsWith(r + "/") ? p.slice(r.length + 1) : p;
}

/** Convert an absolute path to a `file://` URI (for LSP). */
export function fileUri(path: string): string {
  const norm = normalize(path);
  const withSlash = norm.startsWith("/") ? norm : `/${norm}`;
  return `file://${encodeURI(withSlash)}`;
}

/** Convert a `file://` URI back to a filesystem path. */
export function pathFromFileUri(uri: string): string {
  let p = decodeURI(uri.replace(/^file:\/\//, ""));
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1); // Windows: /E:/… -> E:/…
  return p;
}
