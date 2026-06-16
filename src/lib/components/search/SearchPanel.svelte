<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { relativeTo } from "../../domain/paths";
  import type { SearchMatch } from "../../domain/search";

  const ws = getWorkspace();
  let query = $state("");
  let replacement = $state("");
  let results = $state<SearchMatch[]>([]);
  let loading = $state(false);
  let status = $state("");

  async function run() {
    status = "";
    if (query.trim() === "") {
      results = [];
      return;
    }
    loading = true;
    try {
      results = await ws.searchProject(query);
    } finally {
      loading = false;
    }
  }

  async function replaceAll() {
    if (query.trim() === "" || results.length === 0) return;
    loading = true;
    status = "";
    try {
      const r = await ws.replaceInProject(query, replacement);
      if (!r.cancelled) {
        status = `Nahrazeno ${r.total}× v ${r.files} souborech.`;
        await run();
      }
    } finally {
      loading = false;
    }
  }

  const groups = $derived.by(() => {
    const map = new Map<string, SearchMatch[]>();
    for (const m of results) {
      const arr = map.get(m.path) ?? [];
      arr.push(m);
      map.set(m.path, arr);
    }
    return [...map.entries()];
  });

  function display(path: string): string {
    const root = ws.explorer.rootPath;
    return root ? relativeTo(root, path) : path;
  }
</script>

<div class="search">
  <div class="box">
    <input
      placeholder="Hledat v projektu…"
      bind:value={query}
      onkeydown={(e) => e.key === "Enter" && run()}
    />
    <div class="replace-row">
      <input
        placeholder="Nahradit za…"
        bind:value={replacement}
        onkeydown={(e) => e.key === "Enter" && replaceAll()}
      />
      <button
        class="replace-btn"
        title="Nahradit ve všech souborech"
        disabled={results.length === 0 || loading}
        onclick={replaceAll}
      >
        Nahradit vše
      </button>
    </div>
    {#if status}<div class="status">{status}</div>{/if}
  </div>

  {#if !ws.explorer.rootPath}
    <div class="empty">Otevři složku pro hledání napříč projektem.</div>
  {:else if loading}
    <div class="empty">Hledám…</div>
  {:else if query.trim() && results.length === 0}
    <div class="empty">Žádné výsledky.</div>
  {:else}
    <div class="results">
      {#each groups as [path, matches] (path)}
        <div class="file">
          <span class="name">{display(path)}</span>
          <span class="count">{matches.length}</span>
        </div>
        {#each matches as m (m.path + ":" + m.line)}
          <button class="match" title={m.text} onclick={() => ws.openAt(m.path, m.line)}>
            <span class="ln">{m.line}</span>
            <span class="text">{m.text.trim()}</span>
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .box {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .box input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 6px 8px;
    font-family: inherit;
    font-size: 12px;
  }

  .replace-row {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .replace-btn {
    flex: 0 0 auto;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    color: var(--fg);
    border-radius: 5px;
    padding: 0 8px;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }

  .replace-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .replace-btn:not(:disabled):hover {
    border-color: var(--accent);
  }

  .status {
    margin-top: 6px;
    font-size: 11px;
    color: var(--accent);
  }

  .empty {
    padding: 12px 10px;
    color: var(--fg-dim);
    font-size: 12px;
  }

  .results {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px 2px;
    color: var(--fg-dim);
    font-size: 11px;
  }

  .file .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file .count {
    margin-left: auto;
  }

  .match {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--fg);
    padding: 3px 10px 3px 16px;
    cursor: pointer;
    text-align: left;
    font-size: 12px;
  }

  .match:hover {
    background: var(--bg-elev-2);
  }

  .match .ln {
    color: var(--fg-dim);
    flex: 0 0 auto;
    min-width: 28px;
  }

  .match .text {
    font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
