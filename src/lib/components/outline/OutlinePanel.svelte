<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { symbolKindName, type DocSymbol } from "../../lsp/symbols";

  const ws = getWorkspace();

  const buffer = $derived.by(() => {
    const id = ws.layout.activeTabId;
    return id ? (ws.buffers.get(id) ?? null) : null;
  });

  let symbols = $state<DocSymbol[]>([]);
  let loading = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Re-fetch symbols when the active file or its content changes (debounced).
  $effect(() => {
    const path = buffer?.path ?? null;
    void buffer?.content;
    if (timer) clearTimeout(timer);
    if (!path) {
      symbols = [];
      return;
    }
    timer = setTimeout(async () => {
      loading = true;
      try {
        symbols = await ws.documentSymbols(path);
      } catch {
        symbols = [];
      } finally {
        loading = false;
      }
    }, 400);
  });

  function jump(line: number) {
    if (buffer?.path) void ws.openAt(buffer.path, line + 1);
  }
</script>

<div class="outline">
  <div class="header"><span class="title">Osnova</span></div>
  <div class="list">
    {#if loading && symbols.length === 0}
      <div class="empty">Načítám…</div>
    {:else if symbols.length === 0}
      <div class="empty">Žádné symboly. (Vyžaduje běžící jazykový server.)</div>
    {:else}
      {#snippet node(sym: DocSymbol, depth: number)}
        <button class="sym" style="padding-left: {8 + depth * 14}px" onclick={() => jump(sym.line)}>
          <span class="kind">{symbolKindName(sym.kind)}</span>
          <span class="name">{sym.name}</span>
        </button>
        {#each sym.children as child (child.name + ":" + child.line)}
          {@render node(child, depth + 1)}
        {/each}
      {/snippet}
      {#each symbols as s (s.name + ":" + s.line)}
        {@render node(s, 0)}
      {/each}
    {/if}
  </div>
</div>

<style>
  .outline {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
  }

  .empty {
    padding: 10px;
    color: var(--fg-dim);
    font-size: 12px;
  }

  .sym {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--fg);
    padding: 3px 10px;
    cursor: pointer;
    text-align: left;
    font-size: 12.5px;
  }

  .sym:hover {
    background: var(--bg-elev-2);
  }

  .kind {
    flex: 0 0 auto;
    color: var(--fg-dim);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 56px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
