<script lang="ts">
  import {
    FilePlus,
    FolderOpen,
    FolderTree,
    Save,
    PanelLeft,
    Columns2,
    Rows2,
    Eye,
    History,
    GitCompare,
    Sparkles,
    Settings,
    Fingerprint,
    Bot,
  } from "@lucide/svelte";
  import { getWorkspace } from "../application/context";

  let {
    onToggleSidebar,
    onToggleHistory,
    onToggleAi,
    onOpenSettings,
  }: {
    onToggleSidebar: () => void;
    onToggleHistory: () => void;
    onToggleAi: () => void;
    onOpenSettings: () => void;
  } = $props();
  const ws = getWorkspace();
</script>

<div class="toolbar">
  <button class="icon" title="Postranní panel (Ctrl+B)" onclick={onToggleSidebar}>
    <PanelLeft size={16} />
  </button>
  <span class="sep"></span>
  <button class="icon" title="Nový soubor (Ctrl+N)" onclick={() => ws.newFile()}>
    <FilePlus size={16} />
  </button>
  <button class="icon" title="Otevřít soubor (Ctrl+O)" onclick={() => ws.openFromDialog()}>
    <FolderOpen size={16} />
  </button>
  <button class="icon" title="Otevřít složku" onclick={() => ws.openFolder()}>
    <FolderTree size={16} />
  </button>
  <button class="icon" title="Uložit (Ctrl+S)" onclick={() => ws.saveActive()}>
    <Save size={16} />
  </button>
  <button
    class="icon"
    title="Formátovat (Ctrl+Shift+F) · organizovat importy (Ctrl+Shift+O)"
    onclick={() => ws.formatActive("format")}
  >
    <Sparkles size={16} />
  </button>
  <span class="sep"></span>
  <button class="icon" title="Rozdělit vedle sebe" onclick={() => ws.splitActive("row")}>
    <Columns2 size={16} />
  </button>
  <button class="icon" title="Rozdělit pod sebe" onclick={() => ws.splitActive("column")}>
    <Rows2 size={16} />
  </button>
  <button class="icon" title="Náhled vedle (Ctrl+Shift+V)" onclick={() => ws.openPreviewBeside()}>
    <Eye size={16} />
  </button>
  <span class="sep"></span>
  <button class="icon" title="Porovnat soubory" onclick={() => ws.pickAndCompare()}>
    <GitCompare size={16} />
  </button>
  <button class="icon" title="Blame – autor řádků" onclick={() => ws.toggleBlame()}>
    <Fingerprint size={16} />
  </button>
  <button class="icon" title="Historie změn (Ctrl+H)" onclick={onToggleHistory}>
    <History size={16} />
  </button>
  <button class="icon" title="AI chat (Ctrl+I)" onclick={onToggleAi}>
    <Bot size={16} />
  </button>
  <button class="icon" title="Nastavení (Ctrl+,)" onclick={onOpenSettings}>
    <Settings size={16} />
  </button>
  <span class="brand">Facet</span>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 38px;
    padding: 0 8px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .sep {
    width: 1px;
    height: 18px;
    margin: 0 6px;
    background: var(--border);
  }

  .brand {
    margin-left: auto;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--fg-dim);
  }
</style>
