import { getContext, setContext } from "svelte";
import type { Workspace } from "./workspace";

const KEY = Symbol("facet.workspace");

/** Provide the Workspace to the component tree (called once in the root). */
export function setWorkspace(ws: Workspace): void {
  setContext(KEY, ws);
}

/** Resolve the Workspace from context. */
export function getWorkspace(): Workspace {
  const ws = getContext<Workspace>(KEY);
  if (!ws) {
    throw new Error(
      "Workspace context not set — call setWorkspace() in a root component.",
    );
  }
  return ws;
}
