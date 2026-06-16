<script lang="ts">
  import { onMount } from "svelte";
  import { setWorkspace } from "./lib/application/context";
  import { workspace } from "./lib/infrastructure";
  import Toolbar from "./lib/components/Toolbar.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";
  import FileExplorer from "./lib/components/explorer/FileExplorer.svelte";
  import PaneView from "./lib/components/layout/PaneView.svelte";
  import HistoryPanel from "./lib/components/history/HistoryPanel.svelte";
  import CompareView from "./lib/components/compare/CompareView.svelte";
  import SourceControlPanel from "./lib/components/vcs/SourceControlPanel.svelte";
  import SearchPanel from "./lib/components/search/SearchPanel.svelte";
  import ProblemsPanel from "./lib/components/problems/ProblemsPanel.svelte";
  import OutlinePanel from "./lib/components/outline/OutlinePanel.svelte";
  import DebugPanel from "./lib/components/debug/DebugPanel.svelte";
  import Palette from "./lib/components/palette/Palette.svelte";
  import SettingsModal from "./lib/components/settings/SettingsModal.svelte";
  import RenameModal from "./lib/components/rename/RenameModal.svelte";
  import HunkStageModal from "./lib/components/vcs/HunkStageModal.svelte";
  import CloneModal from "./lib/components/vcs/CloneModal.svelte";
  import ContextMenu, { type MenuItem } from "./lib/components/ContextMenu.svelte";
  import AiChatPanel from "./lib/components/ai/AiChatPanel.svelte";
  import InlineEditPanel from "./lib/components/ai/InlineEditPanel.svelte";
  import ProjectEditModal from "./lib/components/ai/ProjectEditModal.svelte";
  import { allTemplates } from "./lib/domain/newFileTemplates";
  import { ENCODINGS } from "./lib/domain/encodings";
  import {
    Files,
    GitBranch,
    Search,
    Bot,
    History,
    CircleAlert,
    ListTree,
    Bug,
  } from "@lucide/svelte";
  import { loadUserTemplates } from "./lib/config/loadTemplates";
  import { Autosave } from "./lib/application/autosave";
  import { coreCommands } from "./lib/application/commands";
  import { relativeTo } from "./lib/domain/paths";

  setWorkspace(workspace);

  const autosave = new Autosave(workspace);
  const compareActive = $derived(workspace.compare.active);

  let sidebarOpen = $state(true);
  let sidebarWidth = $state(240);
  let sidebarView = $state<
    "files" | "search" | "scm" | "problems" | "outline" | "debug"
  >("files");
  let historyOpen = $state(false);
  let aiOpen = $state(false);
  let terminalOpen = $state(false);
  let settingsOpen = $state(false);
  let zen = $state(false);
  let ctxMenu = $state<{ x: number; y: number } | null>(null);
  let palette = $state<"none" | "files" | "commands" | "newfile" | "encoding">("none");

  function editorContextItems(): MenuItem[] {
    const id = workspace.layout.activeTabId;
    const buf = id ? workspace.buffers.get(id) : null;
    const text = !!buf && !buf.binary;
    return [
      { label: "Formátovat", disabled: !text, action: () => workspace.formatActive("format") },
      {
        label: "Organizovat importy",
        disabled: !text,
        action: () => workspace.formatActive("organizeImports"),
      },
      { separator: true },
      {
        label: "AI: Upravit výběr (Ctrl+K)",
        disabled: !text,
        action: () => workspace.startInlineEditFromStatus(),
      },
      { separator: true },
      { header: true, label: "Převést kódování" },
      ...ENCODINGS.map((enc) => ({
        label: enc.label,
        disabled: !text,
        action: () => void workspace.convertEncoding(enc.id),
      })),
      { separator: true },
      {
        label: "AI: Vysvětli výběr",
        disabled: !text,
        action: () => {
          aiOpen = true;
          workspace.aiAsk("explain");
        },
      },
      {
        label: "AI: Refaktoruj výběr",
        disabled: !text,
        action: () => {
          aiOpen = true;
          workspace.aiAsk("refactor");
        },
      },
    ];
  }

  function onEditorContextMenu(e: MouseEvent) {
    if (compareActive) return; // leave the diff view's default behaviour
    e.preventDefault();
    ctxMenu = { x: e.clientX, y: e.clientY };
  }
  let paletteFiles = $state<{ id: string; label: string }[]>([]);
  let resizing = false;

  const commands = $derived(
    coreCommands(workspace, {
      toggleSidebar: () => (sidebarOpen = !sidebarOpen),
      toggleHistory: () => (historyOpen = !historyOpen),
      openSettings: () => (settingsOpen = true),
      showAi: () => (aiOpen = true),
      openNewFile: () => (palette = "newfile"),
      toggleTerminal: () => (terminalOpen = !terminalOpen),
      pickEncoding: () => (palette = "encoding"),
      showFiles: () => {
        sidebarView = "files";
        sidebarOpen = true;
      },
      showSearch: () => {
        sidebarView = "search";
        sidebarOpen = true;
      },
      showScm: () => {
        sidebarView = "scm";
        sidebarOpen = true;
      },
      showProblems: () => {
        sidebarView = "problems";
        sidebarOpen = true;
      },
      showOutline: () => {
        sidebarView = "outline";
        sidebarOpen = true;
      },
      showDebug: () => {
        sidebarView = "debug";
        sidebarOpen = true;
      },
      toggleZen: () => (zen = !zen),
    }),
  );

  async function openQuickOpen() {
    const root = workspace.explorer.rootPath;
    const files = await workspace.listProjectFiles();
    paletteFiles = files.map((p) => ({
      id: p,
      label: root ? relativeTo(root, p) : p,
    }));
    palette = "files";
  }

  function onPalettePick(id: string) {
    if (palette === "files") {
      void workspace.openPath(id);
    } else if (palette === "commands") {
      commands.find((c) => c.id === id)?.run();
    } else if (palette === "newfile") {
      if (id === "empty") {
        workspace.newFile();
      } else {
        const tpl = allTemplates(workspace.settings.current.fileTemplates).find(
          (t) => t.id === id,
        );
        if (tpl) workspace.newFileFromTemplate(tpl);
      }
    } else if (palette === "encoding") {
      void workspace.convertEncoding(id);
    }
    palette = "none";
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && zen) {
      e.preventDefault();
      zen = false;
      return;
    }
    if (e.key === "F5" && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) {
        void workspace.stopDebugging();
      } else if (workspace.debug.state === "stopped") {
        workspace.debug.continue();
      } else if (!workspace.debug.active) {
        void workspace.startDebugging();
      }
      return;
    }
    if (!e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (e.shiftKey) {
      if (e.code === "Period") {
        e.preventDefault();
        void workspace.goToSymbol();
      } else if (key === "z") {
        e.preventDefault();
        zen = !zen;
      } else if (key === "v") {
        e.preventDefault();
        workspace.openPreviewBeside();
      } else if (key === "f") {
        e.preventDefault();
        workspace.formatActive("format");
      } else if (key === "o") {
        e.preventDefault();
        workspace.formatActive("organizeImports");
      } else if (key === "p") {
        e.preventDefault();
        palette = "commands";
      }
      return;
    }
    switch (key) {
      case "s":
        e.preventDefault();
        workspace.saveActive();
        break;
      case "o":
        e.preventDefault();
        workspace.openFromDialog();
        break;
      case "n":
        e.preventDefault();
        palette = "newfile";
        break;
      case "`":
        e.preventDefault();
        terminalOpen = !terminalOpen;
        break;
      case "b":
        e.preventDefault();
        sidebarOpen = !sidebarOpen;
        break;
      case "h":
        e.preventDefault();
        historyOpen = !historyOpen;
        break;
      case "p":
        e.preventDefault();
        void openQuickOpen();
        break;
      case "i":
        e.preventDefault();
        aiOpen = !aiOpen;
        break;
      case ",":
        e.preventDefault();
        settingsOpen = true;
        break;
      case "w": {
        e.preventDefault();
        const leaf = workspace.layout.activeLeaf;
        if (leaf.activeTab) workspace.closeTab(leaf.id, leaf.activeTab);
        break;
      }
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKeydown);
    void initWorkspace();
    return () => {
      window.removeEventListener("keydown", onKeydown);
      autosave.stop();
    };
  });

  async function initWorkspace() {
    await workspace.settings.load();
    workspace.history.setRetentionDays(workspace.settings.current.historyRetentionDays);
    void workspace.history.pruneOld();
    void loadUserTemplates(); // best-effort: custom file-type templates
    // Hot exit: bring back unsaved "untitled" buffers from last session.
    const restored = await workspace.restoreSession();
    if (restored === 0 && workspace.layout.activeLeaf.tabs.length === 0) {
      workspace.newFile();
    }
  }

  // Drive autosave from settings (restarts whenever they change).
  $effect(() => {
    const s = workspace.settings.current;
    autosave.stop();
    if (s.autosaveEnabled) autosave.start(s.autosaveSeconds * 1000);
  });

  function startResize(e: PointerEvent) {
    resizing = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function doResize(e: PointerEvent) {
    if (resizing) sidebarWidth = Math.min(520, Math.max(150, e.clientX));
  }
  function endResize(e: PointerEvent) {
    resizing = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }
</script>

<div class="app">
  {#if !zen}
    <Toolbar
      onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
      onToggleTerminal={() => (terminalOpen = !terminalOpen)}
      onNewFile={() => (palette = "newfile")}
      onOpenSettings={() => (settingsOpen = true)}
    />
  {/if}
  <div class="body">
    {#if sidebarOpen && !zen}
      <aside class="sidebar" style="width: {sidebarWidth}px">
        <div class="side-tabs">
          <button
            class="side-tab"
            class:active={sidebarView === "files"}
            title="Soubory"
            onclick={() => (sidebarView = "files")}
          >
            <Files size={15} />
          </button>
          <button
            class="side-tab"
            class:active={sidebarView === "search"}
            title="Hledat v projektu"
            onclick={() => (sidebarView = "search")}
          >
            <Search size={15} />
          </button>
          <button
            class="side-tab"
            class:active={sidebarView === "scm"}
            title="Správa verzí"
            onclick={() => (sidebarView = "scm")}
          >
            <GitBranch size={15} />
          </button>
          <button
            class="side-tab"
            class:active={sidebarView === "problems"}
            title="Problémy"
            onclick={() => (sidebarView = "problems")}
          >
            <CircleAlert size={15} />
          </button>
          <button
            class="side-tab"
            class:active={sidebarView === "outline"}
            title="Osnova (symboly)"
            onclick={() => (sidebarView = "outline")}
          >
            <ListTree size={15} />
          </button>
          <button
            class="side-tab"
            class:active={sidebarView === "debug"}
            title="Ladění"
            onclick={() => (sidebarView = "debug")}
          >
            <Bug size={15} />
          </button>
        </div>
        <div class="side-body">
          {#if sidebarView === "files"}
            <FileExplorer />
          {:else if sidebarView === "search"}
            <SearchPanel />
          {:else if sidebarView === "scm"}
            <SourceControlPanel />
          {:else if sidebarView === "problems"}
            <ProblemsPanel />
          {:else if sidebarView === "outline"}
            <OutlinePanel />
          {:else}
            <DebugPanel />
          {/if}
        </div>
      </aside>
      <div
        class="sb-splitter"
        role="separator"
        aria-orientation="vertical"
        onpointerdown={startResize}
        onpointermove={doResize}
        onpointerup={endResize}
      ></div>
    {/if}
    <main class="main" oncontextmenu={onEditorContextMenu}>
      {#if compareActive}
        <CompareView />
      {:else}
        <PaneView node={workspace.layout.root} />
      {/if}
    </main>
    {#if historyOpen}
      <aside class="history-side">
        <HistoryPanel />
      </aside>
    {/if}
    {#if aiOpen}
      <aside class="ai-side">
        <AiChatPanel />
      </aside>
    {/if}
    {#if !zen}
      <div class="rail">
        <button
          class="rail-btn"
          class:active={aiOpen}
          title="AI chat (Ctrl+I)"
          onclick={() => (aiOpen = !aiOpen)}
        >
          <Bot size={18} />
        </button>
        <button
          class="rail-btn"
          class:active={historyOpen}
          title="Historie změn (Ctrl+H)"
          onclick={() => (historyOpen = !historyOpen)}
        >
          <History size={18} />
        </button>
      </div>
    {/if}
  </div>
  {#if terminalOpen && !zen}
    <div class="terminal-wrap">
      <!-- xterm.js se načítá lazy až při prvním otevření terminálu -->
      {#await import("./lib/components/terminal/TerminalPanel.svelte") then { default: TerminalPanel }}
        <TerminalPanel onClose={() => (terminalOpen = false)} />
      {/await}
    </div>
  {/if}
  {#if !zen}
    <StatusBar
      onEncodingClick={() => (palette = "encoding")}
      onProblemsClick={() => {
        sidebarView = "problems";
        sidebarOpen = true;
      }}
    />
  {/if}
</div>

{#if zen}
  <button class="zen-exit" title="Ukončit zen mód (Esc)" onclick={() => (zen = false)}>
    Zen — Esc
  </button>
{/if}

{#if palette === "files"}
  <Palette
    placeholder="Otevřít soubor…"
    items={paletteFiles}
    onPick={onPalettePick}
    onClose={() => (palette = "none")}
  />
{:else if palette === "commands"}
  <Palette
    placeholder="Příkaz…"
    items={commands.map((c) => ({ id: c.id, label: c.title, hint: c.hint }))}
    onPick={onPalettePick}
    onClose={() => (palette = "none")}
  />
{:else if palette === "newfile"}
  <Palette
    placeholder="Nový soubor — šablona…"
    items={[
      { id: "empty", label: "Prázdný textový soubor" },
      ...allTemplates(workspace.settings.current.fileTemplates).map((t) => ({
        id: t.id,
        label: `${t.language}: ${t.name}`,
        hint: `.${t.extension}`,
      })),
    ]}
    onPick={onPalettePick}
    onClose={() => (palette = "none")}
  />
{:else if palette === "encoding"}
  <Palette
    placeholder="Převést kódování na…"
    items={ENCODINGS.map((e) => ({ id: e.id, label: e.label }))}
    onPick={onPalettePick}
    onClose={() => (palette = "none")}
  />
{/if}

{#if settingsOpen}
  <SettingsModal onClose={() => (settingsOpen = false)} />
{/if}

{#if workspace.renameUi.request}
  <RenameModal />
{/if}

{#if workspace.hunkUi.file}
  <HunkStageModal />
{/if}

{#if workspace.cloneUi.open}
  <CloneModal />
{/if}

{#if workspace.inlineEdit.target}
  <InlineEditPanel />
{/if}

{#if workspace.projectEditUi.open}
  <ProjectEditModal />
{/if}

{#if ctxMenu}
  <ContextMenu
    x={ctxMenu.x}
    y={ctxMenu.y}
    items={editorContextItems()}
    onClose={() => (ctxMenu = null)}
  />
{/if}

{#if workspace.referencesUi.items}
  <Palette
    placeholder={workspace.referencesUi.placeholder}
    items={workspace.referencesUi.items.map((r, i) => ({ id: String(i), label: r.label }))}
    onPick={(id) => {
      const r = workspace.referencesUi.items?.[Number(id)];
      if (r) void workspace.openAt(r.path, r.line);
      workspace.referencesUi.close();
    }}
    onClose={() => workspace.referencesUi.close()}
  />
{/if}

{#if workspace.codeActionUi.items}
  <Palette
    placeholder="Akce kódu (Quick Fix)…"
    items={workspace.codeActionUi.items.map((a, i) => ({
      id: String(i),
      label: a.title,
      hint: a.isPreferred ? "doporučeno" : a.kind,
    }))}
    onPick={(id) => void workspace.applyCodeAction(Number(id))}
    onClose={() => workspace.codeActionUi.close()}
  />
{/if}

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .sidebar {
    flex: 0 0 auto;
    min-width: 150px;
    background: var(--bg-elev);
    border-right: 1px solid var(--border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .side-tabs {
    display: flex;
    gap: 2px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .side-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .side-tab:hover,
  .side-tab.active {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .side-body {
    flex: 1;
    min-height: 0;
  }

  .sb-splitter {
    flex: 0 0 auto;
    width: 5px;
    cursor: col-resize;
    background: var(--border);
  }

  .sb-splitter:hover {
    background: var(--accent);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .history-side {
    flex: 0 0 280px;
    background: var(--bg-elev);
    border-left: 1px solid var(--border);
    overflow: hidden;
  }

  .ai-side {
    flex: 0 0 340px;
    background: var(--bg-elev);
    border-left: 1px solid var(--border);
    overflow: hidden;
  }

  .terminal-wrap {
    flex: 0 0 260px;
    border-top: 1px solid var(--border);
    overflow: hidden;
  }

  .rail {
    flex: 0 0 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-top: 8px;
    background: var(--bg-elev);
    border-left: 1px solid var(--border);
  }

  .rail-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .rail-btn:hover {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .rail-btn.active {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--fg);
  }

  .zen-exit {
    position: fixed;
    bottom: 12px;
    right: 14px;
    z-index: 60;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elev);
    color: var(--fg-dim);
    padding: 4px 10px;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 0.15s;
  }

  .zen-exit:hover {
    opacity: 1;
    color: var(--fg);
  }
</style>
