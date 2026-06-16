/** Curated editor color themes. Ids match `thememirror` exports (or "default"). */

export interface EditorThemeInfo {
  id: string;
  label: string;
}

export const EDITOR_THEMES: EditorThemeInfo[] = [
  { id: "default", label: "Výchozí (dle motivu)" },
  { id: "dracula", label: "Dracula (tmavý)" },
  { id: "cobalt", label: "Cobalt (tmavý)" },
  { id: "coolGlow", label: "Cool Glow (tmavý)" },
  { id: "espresso", label: "Espresso (tmavý)" },
  { id: "barf", label: "Barf (tmavý)" },
  { id: "ayuLight", label: "Ayu Light (světlý)" },
  { id: "solarizedLight", label: "Solarized Light (světlý)" },
  { id: "tomorrow", label: "Tomorrow (světlý)" },
  { id: "rosePineDawn", label: "Rosé Pine Dawn (světlý)" },
];

export function isKnownEditorTheme(id: string): boolean {
  return EDITOR_THEMES.some((t) => t.id === id);
}
