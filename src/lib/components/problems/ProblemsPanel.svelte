<script lang="ts">
  import { getWorkspace } from "../../application/context";

  const ws = getWorkspace();
  const files = $derived(ws.problemsByFile());
  const total = $derived(files.reduce((n, f) => n + f.diagnostics.length, 0));

  const sevClass = (s: number) => (s === 1 ? "err" : s === 2 ? "warn" : "info");
</script>

<div class="problems">
  <div class="header">
    <span class="title">Problémy {total > 0 ? `(${total})` : ""}</span>
  </div>
  <div class="list">
    {#if total === 0}
      <div class="empty">Žádné problémy. (Vyžaduje běžící jazykový server.)</div>
    {/if}
    {#each files as file (file.path)}
      <div class="file">{file.path}</div>
      {#each file.diagnostics as d, i (i)}
        <button class="row" title={d.message} onclick={() => void ws.openAt(file.path, d.line + 1)}>
          <span class="dot {sevClass(d.severity)}"></span>
          <span class="msg">{d.message}</span>
          <span class="loc">{d.line + 1}:{d.character + 1}</span>
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  .problems {
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

  .file {
    padding: 6px 10px 2px;
    font-size: 11px;
    color: var(--fg-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row {
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

  .row:hover {
    background: var(--bg-elev-2);
  }

  .dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    align-self: center;
  }

  .dot.err {
    background: #f85149;
  }

  .dot.warn {
    background: #d29922;
  }

  .dot.info {
    background: #4aa3ff;
  }

  .msg {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loc {
    flex: 0 0 auto;
    color: var(--fg-dim);
    font-size: 11px;
  }
</style>
