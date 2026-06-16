import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";

/**
 * Resolve an editor color theme to a CodeMirror extension. `thememirror` is
 * loaded lazily so its themes don't weigh down the main bundle. "default"
 * follows the app theme (oneDark for dark, no editor theme for light).
 */
export async function loadEditorTheme(id: string, appTheme: "dark" | "light"): Promise<Extension> {
  const fallback = appTheme === "dark" ? oneDark : [];
  if (id === "default") return fallback;
  try {
    const mod = (await import("thememirror")) as unknown as Record<string, Extension>;
    return mod[id] ?? fallback;
  } catch {
    return fallback;
  }
}
