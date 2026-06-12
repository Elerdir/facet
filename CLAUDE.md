# Facet — pokyny pro práci v repu

Desktopový editor: Tauri 2 (Rust) + Svelte 5 + Vite + TypeScript + CodeMirror 6. Čistý Svelte, **ne** SvelteKit. UI texty česky.

## Příkazy

```powershell
npm run tauri dev                                  # spustit aplikaci (hot-reload)
npm test                                           # frontend testy (Vitest)
npm run check                                      # svelte-check (typy + a11y) — musí být 0 chyb, 0 varování
npm run build                                      # produkční build frontendu
cargo test --manifest-path src-tauri/Cargo.toml    # Rust testy
```

Po každé změně spusť všechny čtyři kontroly. Nová logika = nové testy; bez nich není hotovo.

## Architektura (detail v ARCHITECTURE.md)

Hexagonální (ports & adapters), vrstvy v `src/lib/`:

- `domain/` — čisté funkce a typy, bez frameworku, plně testované
- `ports/` — rozhraní (FileSystemPort, DialogPort, HistoryPort, DiffPort, VcsPort, FormatterPort, LspTransport, WatcherPort)
- `infrastructure/` — Tauri adaptéry + composition root (`index.ts`)
- `application/` — Svelte 5 runes stores (`.svelte.ts`) + fasáda `Workspace`; DI přes Svelte context (`application/context.ts`)
- `components/` — prezentační UI; logiku nedrží
- Rust: `src-tauri/src/` — `commands.rs` (soubory, hledání), `detect.rs`, `diff.rs`, `history.rs` (SQLite), `vcs.rs` (git2), `lsp.rs`, `watch.rs`

## Konvence a zrádnosti

- **Testy s fake adaptéry** z `application/testing/fakes.ts` — žádné mocky Tauri API.
- **Svelte 5 `$state` vrací Proxy**: po `items.push(obj)` vracej `this.get(obj.id)!`, ne původní `obj` (reference před vložením je mrtvá).
- Stores s runes patří do `.svelte.ts` souborů; čistá logika do `domain/` (testuje se bez DOM).
- **IPC pojmenování**: Rust struct pole `snake_case` + `#[serde(rename_all = "camelCase")]`; parametry Tauri příkazů volat z JS camelCase.
- `window.prompt` ve WebView2 nefunguje — používej vlastní modaly.
- Těžké závislosti (Prettier, Shiki, markdown-it, Lezer jazyky) **lazy přes dynamic import** — nepřidávej je do statických importů hlavního bundlu.
- git2 je `default-features = false` (bez sítě) — síťové Git operace jdou přes `git` CLI (`git_sync`).
- Nové typy pohledů v panelu = rozšíření `ViewKind` v `domain/layout.ts` + větev v `PaneContent.svelte`.
