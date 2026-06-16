/**
 * Data-driven global keybindings. Each app command has a default chord; the user
 * can override it in settings. Editor-internal (CodeMirror) keys are separate.
 * Pure and unit-testable — `chordFromEvent` is layout-independent for letters
 * and digits (uses `event.code`).
 */

export interface BindableCommand {
  id: string;
  label: string;
  default: string;
}

export const BINDABLE_COMMANDS: BindableCommand[] = [
  { id: "file.save", label: "Uložit", default: "Ctrl+S" },
  { id: "file.open", label: "Otevřít soubor", default: "Ctrl+O" },
  { id: "file.new", label: "Nový soubor", default: "Ctrl+N" },
  { id: "file.quickOpen", label: "Rychlé otevření souboru", default: "Ctrl+P" },
  { id: "view.commandPalette", label: "Paleta příkazů", default: "Ctrl+Shift+P" },
  { id: "view.toggleSidebar", label: "Postranní panel", default: "Ctrl+B" },
  { id: "view.terminal", label: "Terminál", default: "Ctrl+`" },
  { id: "view.history", label: "Historie", default: "Ctrl+H" },
  { id: "ai.chat", label: "AI chat", default: "Ctrl+I" },
  { id: "app.settings", label: "Nastavení", default: "Ctrl+," },
  { id: "edit.closeTab", label: "Zavřít panel", default: "Ctrl+W" },
  { id: "edit.reopenClosed", label: "Znovuotevřít zavřený panel", default: "Ctrl+Shift+T" },
  { id: "edit.gotoLine", label: "Přejít na řádek", default: "Ctrl+G" },
  { id: "edit.workspaceSymbol", label: "Symbol v projektu", default: "Ctrl+T" },
  { id: "edit.gotoSymbol", label: "Symbol v souboru", default: "Ctrl+Shift+." },
  { id: "view.zen", label: "Zen mód", default: "Ctrl+Shift+Z" },
  { id: "view.previewBeside", label: "Náhled vedle", default: "Ctrl+Shift+V" },
  { id: "edit.format", label: "Formátovat dokument", default: "Ctrl+Shift+F" },
  { id: "edit.organizeImports", label: "Organizovat importy", default: "Ctrl+Shift+O" },
  { id: "debug.startContinue", label: "Ladění: spustit/pokračovat", default: "F5" },
  { id: "debug.stop", label: "Ladění: zastavit", default: "Shift+F5" },
];

interface KeyLike {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey?: boolean;
  key: string;
  code?: string;
}

const PUNCT: Record<string, string> = {
  Backquote: "`",
  Period: ".",
  Comma: ",",
  Slash: "/",
  Minus: "-",
  Equal: "=",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
};

function mainKey(e: KeyLike): string | null {
  const code = e.code ?? "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (PUNCT[code]) return PUNCT[code];
  if (/^F\d{1,2}$/.test(e.key)) return e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  if (e.key === " ") return "Space";
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

/** Normalize a keyboard event into a chord like "Ctrl+Shift+P", or null. */
export function chordFromEvent(e: KeyLike): string | null {
  const key = mainKey(e);
  if (key === null) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(key);
  return parts.join("+");
}

/** The default chord for every bindable command. */
export function defaultKeybindings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of BINDABLE_COMMANDS) out[c.id] = c.default;
  return out;
}

/** Effective chord for a command (override wins; "" unbinds). */
export function effectiveChord(id: string, overrides: Record<string, string>): string {
  const def = BINDABLE_COMMANDS.find((c) => c.id === id)?.default ?? "";
  return id in overrides ? overrides[id] : def;
}

/** Build a chord → commandId lookup from the defaults plus user overrides. */
export function buildChordMap(overrides: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of BINDABLE_COMMANDS) {
    const chord = effectiveChord(c.id, overrides);
    if (chord !== "") map[chord] = c.id;
  }
  return map;
}

/** Validate a raw keybindings setting (commandId → chord strings). */
export function parseKeybindings(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const known = new Set(BINDABLE_COMMANDS.map((c) => c.id));
  const out: Record<string, string> = {};
  for (const [id, chord] of Object.entries(raw as Record<string, unknown>)) {
    if (known.has(id) && typeof chord === "string") out[id] = chord;
  }
  return out;
}
