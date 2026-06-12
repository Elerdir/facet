/**
 * Monotonic id generator factory.
 *
 * Injectable so application stores can be constructed with a deterministic
 * generator in tests (e.g. `createIdGen("buf")` -> "buf-1", "buf-2", ...).
 */
export function createIdGen(prefix = "id"): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
