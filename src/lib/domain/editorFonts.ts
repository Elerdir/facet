/** Preset monospace stacks offered in the editor-font combobox. */
export interface EditorFont {
  label: string;
  value: string;
}

export const EDITOR_FONTS: EditorFont[] = [
  { label: "Cascadia Code", value: '"Cascadia Code", "JetBrains Mono", Consolas, monospace' },
  { label: "JetBrains Mono", value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace' },
  { label: "Fira Code", value: '"Fira Code", Consolas, monospace' },
  { label: "Source Code Pro", value: '"Source Code Pro", Consolas, monospace' },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Courier New", value: '"Courier New", monospace' },
];
