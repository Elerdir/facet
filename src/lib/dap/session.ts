/**
 * Pure parsers for DAP response bodies. Keep `DebugManager` lean and let the
 * fiddly shape-handling be unit-tested in isolation. All functions are total:
 * malformed or missing data yields an empty result, never a throw.
 */

import { pathFromFileUri } from "../domain/paths";

export interface DapThread {
  id: number;
  name: string;
}

export interface DapStackFrame {
  id: number;
  name: string;
  /** Local filesystem path of the frame's source, or null when unavailable. */
  path: string | null;
  line: number;
  column: number;
}

export interface DapScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface DapVariable {
  name: string;
  value: string;
  type?: string;
  /** >0 when the variable is structured and can be expanded. */
  variablesReference: number;
}

function asArray(body: unknown, key: string): Record<string, unknown>[] {
  const raw = (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

export function parseThreads(body: unknown): DapThread[] {
  return asArray(body, "threads").map((t) => ({
    id: Number(t.id ?? 0),
    name: String(t.name ?? `Vlákno ${t.id ?? "?"}`),
  }));
}

export function parseStackFrames(body: unknown): DapStackFrame[] {
  return asArray(body, "stackFrames").map((f) => {
    const source = f.source as { path?: string; sourceReference?: number } | undefined;
    const raw = typeof source?.path === "string" ? source.path : null;
    return {
      id: Number(f.id ?? 0),
      name: String(f.name ?? ""),
      path: raw ? (raw.startsWith("file:") ? pathFromFileUri(raw) : raw) : null,
      line: Number(f.line ?? 0),
      column: Number(f.column ?? 0),
    };
  });
}

export function parseScopes(body: unknown): DapScope[] {
  return asArray(body, "scopes").map((s) => ({
    name: String(s.name ?? ""),
    variablesReference: Number(s.variablesReference ?? 0),
    expensive: Boolean(s.expensive),
  }));
}

export function parseVariables(body: unknown): DapVariable[] {
  return asArray(body, "variables").map((v) => ({
    name: String(v.name ?? ""),
    value: String(v.value ?? ""),
    type: typeof v.type === "string" ? v.type : undefined,
    variablesReference: Number(v.variablesReference ?? 0),
  }));
}
