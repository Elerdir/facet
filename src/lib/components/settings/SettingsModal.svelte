<script lang="ts">
  import { onMount } from "svelte";
  import { getWorkspace } from "../../application/context";
  import type { AiModelInfo } from "../../domain/ai";
  import {
    allTemplates,
    templateLanguages,
    type NewFileTemplate,
  } from "../../domain/newFileTemplates";
  import { EDITOR_FONTS } from "../../domain/editorFonts";

  let { onClose }: { onClose: () => void } = $props();

  const ws = getWorkspace();
  const s = $derived(ws.settings.current);

  type Tab = "general" | "editor" | "templates" | "git" | "ai";
  let tab = $state<Tab>("general");

  // --- Git identita ---------------------------------------------------------
  let gitName = $state("");
  let gitEmail = $state("");
  let gitMsg = $state("");
  let identityLoaded = false;

  $effect(() => {
    if (tab === "git" && !identityLoaded) {
      identityLoaded = true;
      void ws.vcs
        .getIdentity()
        .then((id) => {
          gitName = id.name;
          gitEmail = id.email;
        })
        .catch(() => {});
    }
  });

  async function saveIdentity() {
    try {
      await ws.vcs.setIdentity(gitName.trim(), gitEmail.trim());
      gitMsg = "Identita uložena (git config --global).";
    } catch (e) {
      gitMsg = `Nepodařilo se uložit: ${e}`;
    }
  }

  const fontIsPreset = $derived(EDITOR_FONTS.some((f) => f.value === s.editorFontFamily));

  // --- AI modely (živě z API, jen po zadání tokenu) -------------------------
  let aiModels = $state<AiModelInfo[]>([]);
  let modelsLoading = $state(false);
  let modelsError = $state<string | null>(null);
  let loadedForKey = "";

  $effect(() => {
    const key = s.aiApiKey.trim();
    if (tab !== "ai" || key === "" || key === loadedForKey) return;
    loadedForKey = key;
    modelsLoading = true;
    modelsError = null;
    void ws.ai
      .listModels()
      .then((m) => {
        aiModels = m;
        if (m.length > 0 && !m.some((x) => x.id === s.aiModel)) {
          void ws.settings.update({ aiModel: m[0].id });
        }
      })
      .catch((e) => {
        modelsError = `Nelze načíst modely: ${e}`;
        loadedForKey = ""; // dovolí zkusit znovu
      })
      .finally(() => (modelsLoading = false));
  });

  // --- O aplikaci / aktualizace (UpdateHub) --------------------------------
  let version = $state("…");
  let updateMsg = $state("");
  let updateErr = $state(false);
  let checking = $state(false);
  let pendingInstall = $state<null | (() => Promise<void>)>(null);

  onMount(async () => {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      version = await getVersion();
    } catch {
      version = "0.1.0";
    }
  });

  async function checkUpdates() {
    checking = true;
    updateErr = false;
    updateMsg = "";
    pendingInstall = null;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        updateMsg = `K dispozici je verze ${update.version}${update.body ? ` — ${update.body}` : ""}.`;
        pendingInstall = async () => {
          updateMsg = "Stahuji a instaluji…";
          await update.downloadAndInstall();
          updateMsg = "Nainstalováno — restartuj aplikaci.";
          pendingInstall = null;
        };
      } else {
        updateMsg = "Máš nejnovější verzi.";
      }
    } catch (e) {
      updateErr = true;
      updateMsg = `Server aktualizací (UpdateHub) není dostupný: ${e}`;
    } finally {
      checking = false;
    }
  }

  // --- Šablony --------------------------------------------------------------
  const templates = $derived(allTemplates(s.fileTemplates));
  let selectedTemplate = $state<NewFileTemplate | null>(null);
  let newName = $state("");
  let newExt = $state("");
  let newLanguage = $state("");
  let newContent = $state("");

  function addTemplate() {
    if (!newName.trim() || !newExt.trim()) return;
    void ws.settings.update({
      fileTemplates: [
        ...s.fileTemplates,
        {
          name: newName.trim(),
          extension: newExt.trim().replace(/^\./, ""),
          content: newContent,
          ...(newLanguage.trim() ? { language: newLanguage.trim() } : {}),
        },
      ],
    });
    newName = "";
    newExt = "";
    newLanguage = "";
    newContent = "";
  }

  function removeCustom(index: number) {
    void ws.settings.update({
      fileTemplates: s.fileTemplates.filter((_, i) => i !== index),
    });
    selectedTemplate = null;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={onClose}></button>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="head">
      <span>Nastavení</span>
      <span class="version">Facet {version}</span>
      <button class="x" aria-label="Zavřít (Esc)" onclick={onClose}>✕</button>
    </div>

    <div class="tabs">
      <button class="tab" class:active={tab === "general"} onclick={() => (tab = "general")}>Obecné</button>
      <button class="tab" class:active={tab === "editor"} onclick={() => (tab = "editor")}>Editor</button>
      <button class="tab" class:active={tab === "templates"} onclick={() => (tab = "templates")}>Šablony</button>
      <button class="tab" class:active={tab === "git"} onclick={() => (tab = "git")}>Git</button>
      <button class="tab" class:active={tab === "ai"} onclick={() => (tab = "ai")}>AI</button>
    </div>

    <div class="body">
      {#if tab === "general"}
        <label class="row">
          <input
            type="checkbox"
            checked={s.autosaveEnabled}
            onchange={(e) => ws.settings.update({ autosaveEnabled: e.currentTarget.checked })}
          />
          <span>Automatické ukládání</span>
        </label>

        <label class="row">
          <span>Interval autosave (s)</span>
          <input
            type="number"
            min="5"
            max="3600"
            value={s.autosaveSeconds}
            onchange={(e) => ws.settings.update({ autosaveSeconds: Number(e.currentTarget.value) })}
          />
        </label>

        <label class="row">
          <span>Historie – retence (dny)</span>
          <input
            type="number"
            min="1"
            max="365"
            value={s.historyRetentionDays}
            onchange={(e) => {
              const days = Number(e.currentTarget.value);
              void ws.settings.update({ historyRetentionDays: days });
              ws.history.setRetentionDays(days);
            }}
          />
        </label>

        <label class="row">
          <span>Motiv</span>
          <select
            value={s.theme}
            onchange={(e) =>
              ws.settings.update({ theme: e.currentTarget.value === "light" ? "light" : "dark" })}
          >
            <option value="dark">Tmavý</option>
            <option value="light">Světlý</option>
          </select>
        </label>

        <label class="row">
          <input
            type="checkbox"
            checked={s.lspEnabled}
            onchange={(e) => ws.settings.update({ lspEnabled: e.currentTarget.checked })}
          />
          <span>Jazykové služby (LSP)</span>
        </label>

        <div class="section">Aktualizace</div>
        <div class="row">
          <button class="btn" disabled={checking} onclick={checkUpdates}>
            {checking ? "Kontroluji…" : "Zkontrolovat aktualizace"}
          </button>
          {#if pendingInstall}
            <button class="btn primary" onclick={() => void pendingInstall?.()}>
              Stáhnout a nainstalovat
            </button>
          {/if}
        </div>
        {#if updateMsg}
          <div class="note" class:err={updateErr}>{updateMsg}</div>
        {/if}
      {:else if tab === "editor"}
        <label class="row">
          <span>Písmo editoru</span>
          <select
            class="wide"
            value={fontIsPreset ? s.editorFontFamily : "custom"}
            onchange={(e) => {
              if (e.currentTarget.value !== "custom") {
                void ws.settings.update({ editorFontFamily: e.currentTarget.value });
              }
            }}
          >
            {#each EDITOR_FONTS as f (f.value)}
              <option value={f.value}>{f.label}</option>
            {/each}
            {#if !fontIsPreset}
              <option value="custom">Vlastní ({s.editorFontFamily})</option>
            {/if}
          </select>
        </label>

        <label class="row">
          <span>Velikost písma (px)</span>
          <input
            type="number"
            min="8"
            max="32"
            value={s.editorFontSize}
            onchange={(e) => ws.settings.update({ editorFontSize: Number(e.currentTarget.value) })}
          />
        </label>

        <label class="row">
          <input
            type="checkbox"
            checked={s.editorMinimap}
            onchange={(e) => ws.settings.update({ editorMinimap: e.currentTarget.checked })}
          />
          <span>Minimapa</span>
        </label>

        <div class="note">
          Tučně / kurzíva / podtržení pro výběr najdeš v paletě příkazů
          (Ctrl+Shift+P → „Formát: …").
        </div>
      {:else if tab === "templates"}
        <div class="tpl-grid">
          <div class="tpl-list">
            {#each templateLanguages(templates) as lang (lang)}
              <div class="tpl-lang">{lang}</div>
              {#each templates.filter((t) => t.language === lang) as tpl (tpl.id)}
                <button
                  class="tpl-item"
                  class:sel={selectedTemplate?.id === tpl.id}
                  onclick={() => (selectedTemplate = tpl)}
                >
                  <span>{tpl.name}</span>
                  <span class="ext">.{tpl.extension}</span>
                </button>
              {/each}
            {/each}
          </div>
          <div class="tpl-preview">
            {#if selectedTemplate}
              <div class="tpl-head">
                Náhled: {selectedTemplate.language}: {selectedTemplate.name} (.{selectedTemplate.extension})
                {#if !selectedTemplate.builtin}
                  <button
                    class="btn danger"
                    onclick={() => removeCustom(Number(selectedTemplate!.id.replace("custom-", "")))}
                  >
                    Smazat
                  </button>
                {/if}
              </div>
              <pre>{selectedTemplate.content}</pre>
            {:else}
              <div class="note">Vyber šablonu vlevo pro náhled.</div>
            {/if}
          </div>
        </div>

        <div class="section">Přidat vlastní šablonu</div>
        <div class="tpl-form">
          <input type="text" placeholder="Název (např. Vue komponenta)" bind:value={newName} />
          <input type="text" class="ext-input" placeholder="přípona (vue)" bind:value={newExt} />
          <input
            type="text"
            list="tpl-sections"
            placeholder="Sekce — vyber nebo napiš novou (např. Java, Ansible…)"
            bind:value={newLanguage}
          />
          <datalist id="tpl-sections">
            {#each templateLanguages(templates) as lang (lang)}
              <option value={lang}></option>
            {/each}
          </datalist>
          <textarea rows="4" placeholder="Výchozí obsah souboru…" bind:value={newContent}></textarea>
          <button class="btn primary" disabled={!newName.trim() || !newExt.trim()} onclick={addTemplate}>
            Přidat šablonu
          </button>
        </div>
      {:else if tab === "git"}
        <div class="section">Identita (jméno a e-mail u commitů)</div>
        <label class="row">
          <span>Jméno</span>
          <input type="text" class="wide" bind:value={gitName} />
        </label>
        <label class="row">
          <span>E-mail</span>
          <input type="text" class="wide" bind:value={gitEmail} />
        </label>
        <div class="row">
          <button class="btn" onclick={saveIdentity}>Uložit identitu</button>
        </div>
        {#if gitMsg}<div class="note">{gitMsg}</div>{/if}

        <div class="section">GitHub</div>
        <label class="row">
          <span>Personal Access Token</span>
          <input
            type="password"
            class="wide"
            placeholder="ghp_… / github_pat_…"
            value={s.githubToken}
            onchange={(e) => ws.settings.update({ githubToken: e.currentTarget.value })}
          />
        </label>

        <div class="section">GitLab</div>
        <label class="row">
          <span>Server</span>
          <input
            type="text"
            class="wide"
            placeholder="gitlab.com"
            value={s.gitlabHost}
            onchange={(e) => ws.settings.update({ gitlabHost: e.currentTarget.value })}
          />
        </label>
        <label class="row">
          <span>Personal Access Token</span>
          <input
            type="password"
            class="wide"
            placeholder="glpat-…"
            value={s.gitlabToken}
            onchange={(e) => ws.settings.update({ gitlabToken: e.currentTarget.value })}
          />
        </label>

        <div class="note">
          Tokeny se použijí při klonování a push/pull/fetch přes HTTPS, když
          adresa odpovídá GitHubu / GitLabu. Ukládají se šifrovaně ve správci
          pověření systému (Windows Credential Manager / macOS Keychain) —
          nikdy v souboru nastavení.
        </div>
      {:else}
        <label class="row">
          <span>Claude API klíč</span>
          <input
            type="password"
            class="wide"
            placeholder="sk-ant-…"
            value={s.aiApiKey}
            onchange={(e) => ws.settings.update({ aiApiKey: e.currentTarget.value })}
          />
        </label>

        {#if s.aiApiKey.trim() === ""}
          <div class="note">Zadej API klíč — pak se načtou dostupné modely.</div>
        {:else}
          <label class="row">
            <span>Model</span>
            {#if modelsLoading}
              <span class="note" style="padding:0">Načítám modely…</span>
            {:else if modelsError}
              <span class="note err" style="padding:0">{modelsError}</span>
            {:else}
              <select
                class="wide"
                value={s.aiModel}
                onchange={(e) => ws.settings.update({ aiModel: e.currentTarget.value })}
              >
                {#each aiModels as m (m.id)}
                  <option value={m.id}>{m.label}</option>
                {/each}
              </select>
            {/if}
          </label>

          <label class="row">
            <input
              type="checkbox"
              checked={s.aiGhostCompletion}
              onchange={(e) => ws.settings.update({ aiGhostCompletion: e.currentTarget.checked })}
            />
            <span>Prediktivní doplňování (ghost text, Tab přijme)</span>
          </label>
          <div class="note">
            Pozn.: každá pauza v psaní pošle dotaz do API (platí se za tokeny).
            Pro rychlost a cenu doporučuji zvolit model Haiku.
          </div>
        {/if}

        <div class="note">
          API klíč se ukládá šifrovaně ve správci pověření systému — nikdy
          v souboru nastavení. Nabídka modelů se načítá živě z API, vždy jen
          nejnovější z každé řady.
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 10vh;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
  }

  .modal {
    position: relative;
    width: min(640px, 94vw);
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    flex: 0 0 auto;
  }

  .version {
    margin-left: auto;
    font-weight: 400;
    font-size: 12px;
    color: var(--fg-dim);
  }

  .x {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 14px;
  }

  .x:hover {
    color: var(--fg);
  }

  .tabs {
    display: flex;
    gap: 2px;
    padding: 6px 10px 0;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .tab {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    padding: 7px 12px;
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    font-family: inherit;
    font-size: 13px;
  }

  .tab:hover {
    color: var(--fg);
  }

  .tab.active {
    color: var(--fg);
    background: var(--bg);
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .body {
    overflow: auto;
    padding: 6px 0 14px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    color: var(--fg);
    font-size: 13px;
  }

  .row input[type="number"],
  .row select,
  .row input[type="text"],
  .row input[type="password"] {
    width: 130px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 5px 8px;
    font-family: inherit;
  }

  .row .wide {
    width: 280px;
  }

  .row input[type="checkbox"] {
    margin-right: auto;
  }

  .section {
    padding: 12px 16px 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
    border-top: 1px solid var(--border);
    margin-top: 6px;
  }

  /* První sekce hned pod záložkami — bez druhé oddělovací čáry. */
  .body > .section:first-child {
    border-top: none;
    margin-top: 0;
    padding-top: 8px;
  }

  .note {
    padding: 4px 16px;
    color: var(--fg-dim);
    font-size: 12px;
    white-space: pre-wrap;
  }

  .note.err {
    color: var(--danger);
  }

  .btn {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elev-2);
    color: var(--fg);
    padding: 6px 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .btn.primary {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .btn.danger {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    padding: 2px 8px;
    font-size: 12px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* Templates tab */
  .tpl-grid {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 0;
    min-height: 200px;
    border-bottom: 1px solid var(--border);
  }

  .tpl-list {
    border-right: 1px solid var(--border);
    overflow: auto;
    max-height: 240px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tpl-item {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--fg);
    padding: 6px 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
  }

  .tpl-item:hover {
    background: var(--bg-elev-2);
  }

  .tpl-item.sel {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .tpl-item .ext {
    color: var(--fg-dim);
  }

  .tpl-lang {
    padding: 8px 8px 2px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }

  .tpl-preview {
    padding: 8px 12px;
    overflow: auto;
    max-height: 240px;
  }

  .tpl-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--fg-dim);
    margin-bottom: 6px;
  }

  .tpl-preview pre {
    margin: 0;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: "Cascadia Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    user-select: text;
  }

  .tpl-form {
    display: grid;
    grid-template-columns: 1fr 130px;
    gap: 8px;
    padding: 8px 16px 0;
  }

  .tpl-form input[list] {
    grid-column: 1 / -1;
  }

  .tpl-form input,
  .tpl-form textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 6px 8px;
    font-family: inherit;
    font-size: 12.5px;
  }

  .tpl-form textarea {
    grid-column: 1 / -1;
    font-family: "Cascadia Code", Consolas, monospace;
    resize: vertical;
  }

  .tpl-form .btn {
    grid-column: 1 / -1;
    justify-self: end;
  }
</style>
