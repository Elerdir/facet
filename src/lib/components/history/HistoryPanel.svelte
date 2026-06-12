<script lang="ts">
  import { getWorkspace } from "../../application/context";

  const ws = getWorkspace();

  const activeId = $derived(ws.layout.activeTabId);
  const buf = $derived(activeId ? (ws.buffers.get(activeId) ?? null) : null);
  const path = $derived(buf?.path ?? null);

  let selected = $state<number | null>(null);
  let preview = $state("");
  let lastPath: string | null = null;

  // Reload the revision list when the file changes or after a save (savedContent
  // changes), keeping the current selection unless the file itself changed.
  $effect(() => {
    const p = path;
    void buf?.savedContent;
    if (p) {
      void ws.history.load(p);
      if (p !== lastPath) {
        lastPath = p;
        selected = null;
        preview = "";
      }
    } else {
      ws.history.clear();
      lastPath = null;
      selected = null;
      preview = "";
    }
  });

  async function select(id: number) {
    selected = id;
    preview = (await ws.history.get(id)) ?? "";
  }

  function restore() {
    if (buf && selected !== null) void ws.restoreRevision(buf.id, selected);
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }
</script>

<div class="history">
  <div class="header">Historie{#if buf}: <span class="file">{buf.name}</span>{/if}</div>

  {#if !path}
    <div class="empty">Historie je dostupná pro uložené soubory.</div>
  {:else}
    <div class="list">
      {#each ws.history.revisions as rev (rev.id)}
        <button
          class="rev"
          class:sel={rev.id === selected}
          onclick={() => select(rev.id)}
        >
          <span class="time">{formatTime(rev.createdAt)}</span>
          <span class="size">{rev.size} B</span>
        </button>
      {:else}
        <div class="empty">Zatím žádné revize — vznikají při uložení.</div>
      {/each}
    </div>

    {#if selected !== null}
      <div class="preview"><pre>{preview}</pre></div>
      <button class="restore" onclick={restore}>Obnovit tuto verzi</button>
    {/if}
  {/if}
</div>

<style>
  .history {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
    flex: 0 0 auto;
    gap: 4px;
  }

  .file {
    color: var(--fg);
    text-transform: none;
    letter-spacing: 0;
  }

  .empty {
    padding: 12px 10px;
    color: var(--fg-dim);
    font-size: 12px;
  }

  .list {
    flex: 0 0 auto;
    max-height: 45%;
    overflow: auto;
    padding: 4px 0;
  }

  .rev {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--fg);
    padding: 5px 10px;
    cursor: pointer;
    text-align: left;
    font-size: 12px;
  }

  .rev:hover {
    background: var(--bg-elev-2);
  }

  .rev.sel {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .rev .size {
    color: var(--fg-dim);
  }

  .preview {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }

  .preview pre {
    margin: 0;
    padding: 10px;
    font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 12.5px;
    white-space: pre-wrap;
    user-select: text;
  }

  .restore {
    flex: 0 0 auto;
    margin: 8px 10px;
    padding: 7px 10px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--fg);
    cursor: pointer;
  }

  .restore:hover {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
  }
</style>
