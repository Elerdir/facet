<script lang="ts">
  import { getWorkspace } from "../application/context";
  import { isDirty } from "../domain/buffer";
  import { extension } from "../domain/paths";
  import { detectEol, detectIndent } from "../domain/textInfo";
  import ContextMenu, { type MenuItem } from "./ContextMenu.svelte";

  let {
    onEncodingClick,
    onProblemsClick,
  }: { onEncodingClick: () => void; onProblemsClick: () => void } = $props();

  const ws = getWorkspace();
  const activeId = $derived(ws.layout.activeTabId);
  const buf = $derived(activeId ? (ws.buffers.get(activeId) ?? null) : null);
  const lines = $derived(buf ? buf.content.split("\n").length : 0);
  const lang = $derived(buf ? extension(buf.name).toUpperCase() || "TEXT" : "");
  const eol = $derived(buf ? detectEol(buf.content) : "lf");
  const indent = $derived(buf ? detectIndent(buf.content) : null);

  let indentMenu = $state<{ x: number; y: number } | null>(null);

  function indentItems(): MenuItem[] {
    return [
      { header: true, label: "Odsazení" },
      { label: "Mezery: 2", action: () => ws.setIndentation("spaces", 2) },
      { label: "Mezery: 4", action: () => ws.setIndentation("spaces", 4) },
      { label: "Tabulátory (2)", action: () => ws.setIndentation("tabs", 2) },
      { label: "Tabulátory (4)", action: () => ws.setIndentation("tabs", 4) },
    ];
  }

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
      <button class="sb-btn" title="Přejít na řádek (Ctrl+G)" onclick={() => ws.gotoLine(ws.editorStatus.line)}>
        Ř {ws.editorStatus.line}, Sl {ws.editorStatus.col}
      </button>
      {#if ws.editorStatus.selection > 0}
        <span>{ws.editorStatus.selection} vybráno</span>
      {/if}
      <span>{lines} ř.</span>
      <button
        class="sb-btn"
        title="Odsazení"
        onclick={(e) => (indentMenu = { x: e.clientX, y: e.clientY })}
      >
        {indent?.kind === "tabs" ? "Tabulátory" : `Mezery: ${indent?.size ?? 2}`}
      </button>
      <button
        class="sb-btn"
        title="Přepnout konce řádků"
        onclick={() => ws.setEol(eol === "lf" ? "crlf" : "lf")}
      >
        {eol === "crlf" ? "CRLF" : "LF"}
      </button>
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

{#if indentMenu}
  <ContextMenu
    x={indentMenu.x}
    y={indentMenu.y}
    items={indentItems()}
    onClose={() => (indentMenu = null)}
  />
{/if}

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

  .encoding,
  .sb-btn {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    font: inherit;
    cursor: pointer;
    padding: 0;
  }

  .encoding:hover,
  .sb-btn:hover {
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
