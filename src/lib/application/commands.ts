import type { Workspace } from "./workspace";

export interface Command {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
}

/** UI-level actions the command palette can trigger (owned by the root view). */
export interface UiActions {
  toggleSidebar: () => void;
  toggleHistory: () => void;
  openSettings: () => void;
  showFiles: () => void;
  showSearch: () => void;
  showScm: () => void;
  showProblems: () => void;
  showOutline: () => void;
  showDebug: () => void;
  openGotoLine: () => void;
  openWorkspaceSymbols: () => void;
  showAi: () => void;
  openNewFile: () => void;
  toggleTerminal: () => void;
  pickEncoding: () => void;
  toggleZen: () => void;
}

/** The built-in command set surfaced in the command palette. */
export function coreCommands(ws: Workspace, ui: UiActions): Command[] {
  return [
    { id: "file.new", title: "Nový soubor…", hint: "Ctrl+N", run: ui.openNewFile },
    { id: "file.encoding", title: "Soubor: Převést kódování…", run: ui.pickEncoding },
    { id: "file.open", title: "Otevřít soubor…", hint: "Ctrl+O", run: () => void ws.openFromDialog() },
    { id: "file.openFolder", title: "Otevřít složku…", run: () => void ws.openFolder() },
    { id: "file.save", title: "Uložit", hint: "Ctrl+S", run: () => void ws.saveActive() },
    { id: "edit.codeAction", title: "Rychlé opravy / akce kódu…", hint: "Ctrl+.", run: () => ws.requestCodeActionsAtCursor() },
    { id: "edit.format", title: "Formátovat dokument", hint: "Ctrl+Shift+F", run: () => void ws.formatActive("format") },
    { id: "edit.organizeImports", title: "Organizovat importy", hint: "Ctrl+Shift+O", run: () => void ws.formatActive("organizeImports") },
    { id: "view.previewBeside", title: "Náhled vedle", hint: "Ctrl+Shift+V", run: () => ws.openPreviewBeside() },
    { id: "view.splitRow", title: "Rozdělit vedle sebe", run: () => ws.splitActive("row") },
    { id: "view.splitColumn", title: "Rozdělit pod sebe", run: () => ws.splitActive("column") },
    { id: "view.toggleSidebar", title: "Přepnout postranní panel", hint: "Ctrl+B", run: ui.toggleSidebar },
    { id: "view.files", title: "Zobrazit soubory", run: ui.showFiles },
    { id: "view.search", title: "Hledat v projektu", run: ui.showSearch },
    { id: "view.scm", title: "Zobrazit změny (Git)", run: ui.showScm },
    { id: "view.problems", title: "Zobrazit problémy", run: ui.showProblems },
    { id: "view.outline", title: "Zobrazit osnovu (symboly)", run: ui.showOutline },
    { id: "edit.gotoLine", title: "Přejít na řádek…", hint: "Ctrl+G", run: ui.openGotoLine },
    {
      id: "edit.gotoSymbol",
      title: "Přejít na symbol v souboru…",
      hint: "Ctrl+Shift+.",
      run: () => void ws.goToSymbol(),
    },
    {
      id: "edit.workspaceSymbol",
      title: "Hledat symbol v projektu…",
      hint: "Ctrl+T",
      run: ui.openWorkspaceSymbols,
    },
    { id: "view.debug", title: "Zobrazit ladění", run: ui.showDebug },
    {
      id: "debug.start",
      title: "Ladění: Spustit",
      hint: "F5",
      run: () => {
        ui.showDebug();
        void ws.startDebugging();
      },
    },
    { id: "debug.stop", title: "Ladění: Zastavit", hint: "Shift+F5", run: () => void ws.stopDebugging() },
    { id: "debug.continue", title: "Ladění: Pokračovat", run: () => ws.debug.continue() },
    { id: "debug.stepOver", title: "Ladění: Překročit", run: () => ws.debug.next() },
    { id: "debug.stepInto", title: "Ladění: Vstoupit", run: () => ws.debug.stepIn() },
    { id: "debug.stepOut", title: "Ladění: Vystoupit", run: () => ws.debug.stepOut() },
    { id: "git.clone", title: "Git: Klonovat repozitář…", run: () => ws.cloneUi.show() },
    { id: "git.init", title: "Git: Inicializovat repozitář", run: () => void ws.initRepo() },
    { id: "view.history", title: "Přepnout historii", hint: "Ctrl+H", run: ui.toggleHistory },
    { id: "tools.compare", title: "Porovnat soubory…", run: () => void ws.pickAndCompare() },
    { id: "view.terminal", title: "Terminál: Přepnout", hint: "Ctrl+`", run: ui.toggleTerminal },
    { id: "view.zen", title: "Zobrazení: Zen mód", hint: "Ctrl+Shift+Z", run: ui.toggleZen },
    { id: "fmt.bold", title: "Formát: Tučně (výběr)", run: () => ws.textFormat.apply("bold") },
    { id: "fmt.italic", title: "Formát: Kurzíva (výběr)", run: () => ws.textFormat.apply("italic") },
    { id: "fmt.underline", title: "Formát: Podtržení (výběr)", run: () => ws.textFormat.apply("underline") },
    { id: "fmt.strike", title: "Formát: Přeškrtnutí (výběr)", run: () => ws.textFormat.apply("strikethrough") },
    { id: "fmt.code", title: "Formát: Kód (výběr)", run: () => ws.textFormat.apply("code") },
    { id: "ai.chat", title: "AI: Otevřít chat", hint: "Ctrl+I", run: ui.showAi },
    {
      id: "ai.inlineEdit",
      title: "AI: Upravit výběr (inline)",
      hint: "Ctrl+K",
      run: () => ws.startInlineEditFromStatus(),
    },
    {
      id: "ai.projectEdit",
      title: "AI: Upravit napříč soubory…",
      run: () => ws.projectEditUi.show(),
    },
    {
      id: "ai.reindex",
      title: "AI: Přeindexovat projekt (@codebase)",
      run: () => void ws.ensureCodebaseIndex(true),
    },
    {
      id: "ai.explain",
      title: "AI: Vysvětli výběr / soubor",
      run: () => {
        ui.showAi();
        ws.aiAsk("explain");
      },
    },
    {
      id: "ai.refactor",
      title: "AI: Refaktoruj výběr / soubor",
      run: () => {
        ui.showAi();
        ws.aiAsk("refactor");
      },
    },
    { id: "app.settings", title: "Nastavení…", hint: "Ctrl+,", run: ui.openSettings },
  ];
}
