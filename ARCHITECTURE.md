# Architektura Facetu

Hexagonální architektura (ports & adapters): veškerá logika žije v čistých, testovatelných modulech; Tauri/Rust a DOM jsou výměnné okraje.

## Vrstvy (frontend, `src/lib/`)

```
components/      prezentační UI (Svelte 5) — logiku nedrží
    ↓ čte přes Svelte context
application/     runes stores (.svelte.ts) + fasáda Workspace — orchestrace
    ↓ závisí jen na
ports/           rozhraní (FileSystemPort, DialogPort, HistoryPort, DiffPort,
                 VcsPort, FormatterPort, LspTransport, WatcherPort)
    ↑ implementuje
infrastructure/  Tauri adaptéry + composition root (index.ts)
domain/          čisté funkce a typy (paths, buffer, layout, diff, fuzzy, …)
```

- **`Workspace`** (`application/workspace.ts`) je fasáda nad stores (buffers, layout, explorer, history, compare, vcs, settings, lsp). Komponenty ji dostávají přes context (`setWorkspace`/`getWorkspace`); testy ji staví s fake adaptéry z `application/testing/fakes.ts`.
- **Layout** je immutable binární strom (`domain/layout.ts`): leaf = skupina tabů s `ViewKind` (`editor` | `preview` | `hex`), split = orientace + poměry. Všechny operace jsou čisté funkce; `LayoutStore` jen drží `$state` kořen.
- **Buffery** jsou sdílené mezi panely (jeden soubor = jeden buffer). Dirty stav se odvozuje porovnáním `content` vs. `savedContent`.

## Rust (`src-tauri/src/`)

| Modul | Role |
|---|---|
| `commands.rs` | čtení/zápis souborů, file_info (binárka/kódování), chunk čtení, výpis stromů, fulltext hledání (`ignore` + `regex`), stdin→stdout runner pro externí nástroje |
| `detect.rs` | čisté: null-byte detekce binárky, kódování (BOM → UTF-8 → chardetng) |
| `diff.rs` | čisté: zarovnaný side-by-side diff (crate `similar`) |
| `history.rs` | lokální historie revizí v SQLite (rusqlite bundled), čisté funkce nad `Connection` |
| `vcs.rs` | trait `VersionControl` + `GitVcs` (git2 bez sítě); fetch/pull/push přes `git` CLI |
| `lsp.rs` | transport: jazykový server jako child proces, relé stdout↔stdin přes Tauri eventy |
| `watch.rs` | file watcher (notify), noise filtr, eventy `fs:change` |

Zásada: Rust dělá I/O a výkonové operace; protokolová a aplikační logika je v testovaném TypeScriptu.

## Klíčová rozhodnutí

- **Zvýraznění dvoucestně**: Lezer (inkrementální, rychlé) pro běžné jazyky; TextMate přes Shiki pro ~200 dalších + uživatelské `.tmLanguage.json`. Resolver: `editor/highlighting.ts`. Nad 2 MiB se TextMate vypíná (`LARGE_TEXT_BYTES`).
- **Lazy code-split**: Prettier, Shiki (vč. WASM), markdown-it i jednotlivé Lezer parsery se načítají dynamickým importem až při prvním použití — startovní bundle je jen CodeMirror jádro + Svelte.
- **LSP**: framing (`lsp/protocol.ts`) a klient (`application/lsp.svelte.ts`) jsou čisté a testované s fake transportem; Rust je jen roura. Mapování přípona→server v `lsp/servers.ts`.
- **VCS jako provider**: trait v Rustu + `VcsPort` v TS — vlastní/jiný verzovací systém = další implementace, jádro editoru se nemění.
- **Pohledy panelu jako data**: nový typ zobrazení = hodnota `ViewKind` + větev v `PaneContent.svelte` (tak vznikl hex i preview).
- **Bezpečné výchozí chování**: markdown render s `html:false`; externí změny souborů nikdy nepřepíšou neuložené lokální editace; mazání revizí jen retencí.

## Testovací strategie

- `domain/` a `lsp/` — čisté unit testy (Vitest).
- `application/` — stores s fake adaptéry; LSP klient s naskriptovaným fake serverem (initialize → completion → diagnostika).
- Editor integrace — reálný CodeMirror `EditorView` v jsdom (dekorace se skutečně aplikují).
- Rust — unit testy nad temp adresáři/in-memory SQLite/temp git repy.
- CI (`.github/workflows/ci.yml`): svelte-check + Vitest + build + cargo test.
