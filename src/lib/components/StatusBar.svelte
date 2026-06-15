<script lang="ts">
  import { getWorkspace } from "../application/context";
  import { isDirty } from "../domain/buffer";
  import { extension } from "../domain/paths";

  let {
    onEncodingClick,
    onProblemsClick,
  }: { onEncodingClick: () => void; onProblemsClick: () => void } = $props();

  const ws = getWorkspace();
  const activeId = $derived(ws.layout.activeTabId);
  const buf = $derived(activeId ? (ws.buffers.get(activeId) ?? null) : null);
  const lines = $derived(buf ? buf.content.split("\n").length : 0);
  const lang = $derived(buf ? extension(buf.name).toUpperCase() || "TEXT" : "");

  const problemCounts = $derived.by(() => {
    let err = 0;
    let warn = 0;
    for (const diags of Object.values(ws.lsp.diagnostics)) {
      for (const d of diags) {
        if (d.severity === 1) err++;
        else if (d.severity === 2) warn++;
      }
    }
    return { err, warn };
  });
</script>

<div class="statusbar">
  <button class="problems" title="Problémy" onclick={onProblemsClick}>
    <span class="pe">⊘ {problemCounts.err}</span>
    <span class="pw">⚠ {problemCounts.warn}</span>
  </button>
  {#if buf}
    <span class="path">{buf.path ?? "neuložený soubor"}</span>
    <span class="spacer"></span>
    {#if isDirty(buf)}
      <span class="dirty">● změněno</span>
    {/if}
    {#if buf.binary}
      <span>binární</span>
    {:else}
      <span>Ř {ws.editorStatus.line}, Sl {ws.editorStatus.col}</span>
      {#if ws.editorStatus.selection > 0}
        <span>{ws.editorStatus.selection} vybráno</span>
      {/if}
      <span>{lines} ř.</span>
    {/if}
    <span>{lang}</span>
    <button class="encoding" title="Převést kódování…" onclick={onEncodingClick}>
      {buf.encoding}
    </button>
    {#if buf.size > 0}
      <span>{buf.size.toLocaleString()} B</span>
    {/if}
  {/if}
</div>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 24px;
    padding: 0 12px;
    background: var(--bg-elev);
    border-top: 1px solid var(--border);
    color: var(--fg-dim);
    font-size: 12px;
    flex: 0 0 auto;
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spacer {
    flex: 1;
  }

  .dirty {
    color: var(--accent);
  }

  .encoding {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    font: inherit;
    cursor: pointer;
    padding: 0;
  }

  .encoding:hover {
    color: var(--fg);
    text-decoration: underline;
  }

  .problems {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: transparent;
    color: var(--fg-dim);
    font: inherit;
    cursor: pointer;
    padding: 0 8px 0 0;
  }

  .problems:hover {
    color: var(--fg);
  }

  .pe {
    color: #f85149;
  }

  .pw {
    color: #d29922;
  }
</style>
