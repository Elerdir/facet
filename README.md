# Facet

Rychlý desktopový editor kódu i textu. Otevře jakýkoli soubor — se zvýrazněním syntaxe pro 200+ jazyků, hex zobrazením pro binárky a vlastními šablonami typů souborů. Postaveno na Tauri 2 (Rust) + Svelte 5 + CodeMirror 6.

## Funkce

- **Editace** — multi-kurzor, undo/redo, hledat/nahradit (`Ctrl+F`), formátování (Prettier vestavěně, rustfmt/gofmt/black externě), organize imports
- **Zvýraznění** — rychlé Lezer gramatiky pro běžné jazyky, TextMate (Shiki) fallback pro ~200 dalších, vlastní šablony přes `filetypes.json`
- **Layout** — taby, split panely vodorovně i svisle, strom adresářů, živý Markdown náhled vedle editoru
- **Jakýkoli soubor** — detekce kódování (UTF-8/16, legacy), binárky v hex zobrazení s windowed čtením (otevře i mnoha-GB soubory), velké textové soubory bez zpomalení
- **Záchranná síť** — autosave, vícedenní lokální historie revizí s obnovou (SQLite), hot-exit pro neuložené buffery, potvrzení při zavření neuloženého, auto-reload při externí změně souboru
- **Git** — status/stage/commit, větve, fetch/pull/push, commit log, blame v editoru, diff proti HEAD
- **Porovnávání souborů** — side-by-side diff s vnitrořádkovým zvýrazněním změn
- **LSP** — diagnostika (vlnovky), completion, hover, go-to-definition (`F12`), find references (`Shift+F12`), rename (`F2`) — s `typescript-language-server`, `rust-analyzer`, `pyright`, `gopls`
- **Produktivita** — command palette (`Ctrl+Shift+P`), fuzzy otevírání souborů (`Ctrl+P`), hledání napříč projektem, nastavení s tmavým/světlým motivem

## Spuštění

```powershell
# vývoj (hot-reload)
npm install
npm run tauri dev

# nebo dvojklikem: Facet.bat (spustí/sestaví release build)
```

## Instalátory

- **Windows:** spusť `build-installer.bat` → vznikne NSIS setup `.exe` a `.msi` v `src-tauri/target/release/bundle/`
- **macOS:** instalátor **nelze** sestavit na Windows (vyžaduje Apple toolchain). Buď spusť `build-installer.sh` na Macu, nebo pushni tag `v*` na GitHub — workflow `.github/workflows/release.yml` sestaví instalátory pro **obě platformy** automaticky.

## Testy a kontroly

```powershell
npm test                                   # frontend (Vitest)
npm run check                              # typy + a11y (svelte-check)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust
```

## Klávesové zkratky

| Zkratka | Akce |
|---|---|
| `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+W` | nový / otevřít / uložit / zavřít tab |
| prostřední tlačítko myši na tabu | zavřít tab |
| `Ctrl+P` / `Ctrl+Shift+P` | rychlé otevření souboru / paleta příkazů |
| `Ctrl+F` | hledat/nahradit v souboru |
| `Ctrl+B` / `Ctrl+H` / `Ctrl+,` | postranní panel / historie / nastavení |
| `Ctrl+Shift+V` | Markdown náhled vedle |
| `Ctrl+Shift+F` / `Ctrl+Shift+O` | formátovat / organizovat importy |
| `F12` / `Ctrl+klik` | jít na definici |
| `Shift+F12` / `F2` | najít reference / přejmenovat symbol |

## Vývojový postup (GitHub)

- Do `main` se **nepushuje přímo** — práce jde přes větev a pull request; merge povolí až zelené CI (`build-and-test`).
- **Instalační balíčky na vyžádání:** GitHub → **Actions → Installers → Run workflow** — sestaví Windows (.exe/.msi) i macOS (.dmg) balíčky jako artefakty.
- **Release:** push tagu `v*` spustí `release.yml`, který vytvoří draft release s instalátory pro obě platformy.

```powershell
git checkout -b feature/moje-zmena
# … změny, commit …
git push -u origin feature/moje-zmena
gh pr create --fill          # PR; po zelených testech merge
```

## Vlastní šablony typů souborů

Do konfiguračního adresáře aplikace (`%APPDATA%/com.ladik.facet` na Windows) přidej `filetypes.json`:

```json
{
  "fileTypes": [{ "extensions": ["myx"], "language": "toml" }],
  "grammars": ["my-lang.tmLanguage.json"]
}
```

Podrobnosti o návrhu viz [ARCHITECTURE.md](ARCHITECTURE.md), historie změn v [CHANGELOG.md](CHANGELOG.md).
