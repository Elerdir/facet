<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { symbolKindName, type WorkspaceSymbol } from "../../lsp/symbols";
  import { relativeTo } from "../../domain/paths";

  let { onClose }: { onClose: () => void } = $props();

  const ws = getWorkspace();
  let query = $state("");
  let results = $state<WorkspaceSymbol[]>([]);
  let index = $state(0);
  let loading = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Query the language servers live (debounced); they do the matching.
  $effect(() => {
    const q = query;
    if (timer) clearTimeout(timer);
    if (q.trim() === "") {
      results = [];
      return;
    }
    timer = setTimeout(async () => {
      loading = true;
      try {
        const r = await ws.searchWorkspaceSymbols(q);
        results = r.slice(0, 200);
        index = 0;
      } finally {
        loading = false;
      }
    }, 200);
  });

  function pick(sym: WorkspaceSymbol) {
    void ws.openAt(sym.path, sym.line + 1);
    onClose();
  }

  function display(path: string): string {
    const root = ws.explorer.rootForPath(path) ?? ws.explorer.rootPath;
    return root ? relativeTo(root, path) : path;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      index = Math.min(index + 1, results.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      index = Math.max(index - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[index]) pick(results[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={onClose}></button>
  <div class="palette" role="dialog" aria-modal="true">
    <!-- svelte-ignore a11y_autofocus -->
    <input placeholder="Symbol v projektu… (Ctrl+T)" bind:value={query} onkeydown={onKey} autofocus />
    <div class="list">
      {#if loading && results.length === 0}
        <div class="none">Hledám…</div>
      {:else if query.trim() && results.length === 0}
        <div class="none">Žádné symboly. (Vyžaduje běžící jazykový server.)</div>
      {:else}
        {#each results as sym, i (sym.path + ":" + sym.line + ":" + sym.name)}
          <button
            class="item"
            class:sel={i === index}
            onclick={() => pick(sym)}
            onpointermove={() => (index = i)}
          >
            <span class="kind">{symbolKindName(sym.kind)}</span>
            <span class="name">{sym.name}</span>
            <span class="loc">{display(sym.path)}:{sym.line + 1}</span>
          </button>
        {/each}
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
    padding-top: 12vh;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
  }

  .palette {
    position: relative;
    width: min(680px, 92vw);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  input {
    border: none;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--fg);
    padding: 12px 14px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
  }

  .list {
    overflow: auto;
    padding: 4px;
  }

  .item {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--fg);
    padding: 7px 10px;
    cursor: pointer;
    text-align: left;
  }

  .item.sel {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .kind {
    flex: 0 0 auto;
    min-width: 60px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-dim);
  }

  .name {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loc {
    margin-left: auto;
    color: var(--fg-dim);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .none {
    padding: 12px;
    color: var(--fg-dim);
  }
</style>
