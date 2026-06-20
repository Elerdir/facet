# Changelog

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/), verzování podle [SemVer](https://semver.org/lang/cs/).

## [1.0.1] – 2026-06-18

### Opraveno
- Aplikace v release buildu padala hned po startu (`PluginInitialization("updater", … must use a secure protocol like https)`). Updater endpoint přepnut z `http://` na `https://`, takže Tauri projde validací a okno se otevře. (Kontrola aktualizací zůstává funkční, jen vyžaduje běžící HTTPS UpdateHub.)

## [1.0.0] – 2026-06-18

Milník 1.0 — kompletní funkční editor. Shrnutí přírůstků od 0.1.0:

### AI (Cursor-style)
- Inline AI úprava (Ctrl+K), multi-file Composer, `@soubor` / `@codebase` (lokální RAG, BM25), ghost completion

### Jazykové služby (LSP)
- Diagnostika, completion, hover, goto-definition, reference, rename, dokumentové symboly
- Code actions / Quick Fixes (Ctrl+.), signature help, inlay hints, document highlight, range formatting
- Problémy + Osnova panel, breadcrumbs, sticky scroll, Go to Symbol (Ctrl+Shift+.), symbol v projektu (Ctrl+T)
- Vestavěné servery: TS/JS, Rust, Python, Go, C/C++ (clangd), Lua, Bash, JSON, HTML, CSS/SCSS/LESS, YAML; + vlastní v nastavení

### Ladění
- Debugger přes Debug Adapter Protocol (breakpointy, krokování, zásobník, proměnné, výstup)

### Git
- Stage/commit/branch/sync/log/blame/clone/init, stage po blocích, change gutter, merge konflikty, stash, discard/revert

### Editor a workspace
- Find & Replace napříč projektem, multi-root workspace, per-projektové `.facet.json`
- Snippety s tab-stopy, color swatches, TODO/FIXME zvýraznění, barevné motivy, render bílých znaků
- Editovatelné klávesové zkratky, Go to Line, status-bar (EOL/odsazení), správa tabů (pin, znovuotevření)
- Recent folders + uvítací obrazovka, drag & drop z OS
- Terminál (více relací), lokální historie + autosave, hot-exit, porovnávání souborů, minimapa

## [0.1.0] – 2026-06-12

První ucelené vydání.

### Editor
- CodeMirror 6: multi-kurzor, undo/redo, hledat/nahradit, čísla řádků, tmavý/světlý motiv
- Zvýraznění syntaxe: Lezer (JS/TS, JSON, HTML, CSS, Markdown, Rust, Python) + TextMate/Shiki fallback pro ~200 jazyků, lazy-loaded
- Vlastní šablony typů souborů (`filetypes.json` + vlastní `.tmLanguage.json`)
- Formátování: Prettier vestavěně (JS/TS, JSON, CSS, HTML, MD, YAML), externí rustfmt/gofmt/black; organize imports (ruff/goimports)

### Soubory a layout
- Taby, split panely (vodorovně/svisle), strom adresářů s lazy načítáním
- Živý Markdown náhled vedle editoru
- Detekce kódování (BOM, UTF-8/16, legacy přes chardetng); binárky v hex zobrazení s windowed čtením; velké soubory bez whole-doc tokenizace
- Fuzzy quick-open (`Ctrl+P`), command palette (`Ctrl+Shift+P`), hledání napříč projektem (respektuje `.gitignore`)

### Záchranná síť
- Autosave (konfigurovatelný interval), lokální historie revizí v SQLite s retencí a obnovou
- Hot-exit: neuložené „bez názvu“ buffery přežijí restart
- Potvrzení při zavírání neuložených změn; auto-reload čistých bufferů při externí změně (file watcher)

### Git
- Status, stage/unstage, commit; větve (přepnutí/vytvoření); fetch/pull/push; commit log; blame gutter; diff proti HEAD
- Porovnání libovolných dvou souborů: side-by-side s vnitrořádkovým zvýrazněním

### LSP
- Diagnostika (vlnovky), completion, hover, go-to-definition (`F12`/`Ctrl+klik`), find references (`Shift+F12`), rename (`F2`)
- Servery: typescript-language-server, rust-analyzer, pyright, gopls (pokud jsou nainstalované)

### Infrastruktura
- Hexagonální architektura, 178 frontend + 28 Rust testů, CI workflow, release workflow pro Windows + macOS instalátory
