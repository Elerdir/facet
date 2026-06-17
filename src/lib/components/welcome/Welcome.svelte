<script lang="ts">
  import { FolderOpen, FilePlus, GitBranch, History } from "@lucide/svelte";
  import { getWorkspace } from "../../application/context";
  import { basename, dirname } from "../../domain/paths";

  const ws = getWorkspace();
</script>

<div class="welcome">
  <div class="inner">
    <h1>Facet</h1>
    <p class="tagline">Rychlý editor kódu i textu</p>

    <div class="actions">
      <button onclick={() => ws.openFolder()}>
        <FolderOpen size={16} /> Otevřít složku
      </button>
      <button onclick={() => ws.newFile()}>
        <FilePlus size={16} /> Nový soubor
      </button>
      <button onclick={() => ws.cloneUi.show()}>
        <GitBranch size={16} /> Klonovat repozitář
      </button>
    </div>

    {#if ws.recent.folders.length > 0}
      <div class="recent">
        <div class="recent-title"><History size={13} /> Naposledy otevřené</div>
        {#each ws.recent.folders as folder (folder)}
          <button class="recent-row" title={folder} onclick={() => void ws.openFolderPath(folder)}>
            <span class="rname">{basename(folder)}</span>
            <span class="rpath">{dirname(folder)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .welcome {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
  }

  .inner {
    width: min(520px, 86vw);
    padding: 24px;
  }

  h1 {
    margin: 0;
    font-size: 34px;
    letter-spacing: -0.02em;
  }

  .tagline {
    margin: 4px 0 24px;
    color: var(--fg-dim);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--border);
    background: var(--bg-elev);
    color: var(--fg);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
    text-align: left;
  }

  .actions button:hover {
    border-color: var(--accent);
    background: var(--bg-elev-2);
  }

  .recent-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
    margin-bottom: 6px;
  }

  .recent-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--fg);
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
  }

  .recent-row:hover {
    background: var(--bg-elev-2);
  }

  .rname {
    flex: 0 0 auto;
    font-weight: 600;
  }

  .rpath {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg-dim);
    font-size: 12px;
  }
</style>
