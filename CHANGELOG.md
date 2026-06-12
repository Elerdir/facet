# Changelog

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/), verzování podle [SemVer](https://semver.org/lang/cs/).

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
