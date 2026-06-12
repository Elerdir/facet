<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { inlineDiff } from "../../domain/diff";

  const ws = getWorkspace();
  const c = ws.compare;

  function fileName(p: string | null): string {
    return p ? (p.replace(/\\/g, "/").split("/").pop() ?? p) : "";
  }

  function split(text: string, other: string) {
    const { prefix, suffix } = inlineDiff(text, other);
    return {
      pre: text.slice(0, prefix),
      mid: text.slice(prefix, text.length - suffix),
      suf: text.slice(text.length - suffix),
    };
  }
</script>

{#snippet sideCell(text: string | null, other: string | null, kind: string)}
  {#if text === null}
    <span class="filler"></span>
  {:else if kind === "changed" && other !== null}
    {@const m = split(text, other)}
    <span>{m.pre}<mark>{m.mid}</mark>{m.suf}</span>
  {:else}
    <span>{text}</span>
  {/if}
{/snippet}

<div class="compare">
  <div class="head">
    <div class="title">{fileName(c.leftPath)}</div>
    <div class="title">{fileName(c.rightPath)}</div>
    <button class="close" title="Zavřít porovnání" onclick={() => ws.closeCompare()}>
      ✕
    </button>
  </div>

  {#if c.loading}
    <div class="info">Porovnávám…</div>
  {:else if c.error}
    <div class="info err">{c.error}</div>
  {:else}
    <div class="grid">
      {#each c.rows as row, i (i)}
        <div class="ln {row.kind}">{row.leftLine ?? ""}</div>
        <div class="code {row.kind}">{@render sideCell(row.left, row.right, row.kind)}</div>
        <div class="ln {row.kind}">{row.rightLine ?? ""}</div>
        <div class="code {row.kind}">{@render sideCell(row.right, row.left, row.kind)}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .compare {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .head {
    display: flex;
    align-items: center;
    height: 32px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .title {
    flex: 1;
    padding: 0 12px;
    font-size: 12px;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title:first-child {
    border-right: 1px solid var(--border);
  }

  .close {
    width: 34px;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .close:hover {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .info {
    padding: 16px;
    color: var(--fg-dim);
  }

  .info.err {
    color: var(--danger);
  }

  .grid {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: 52px 1fr 52px 1fr;
    align-content: start;
    font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 12.5px;
    line-height: 1.5;
    user-select: text;
  }

  .ln {
    text-align: right;
    padding: 0 8px;
    color: var(--fg-dim);
    user-select: none;
    border-right: 1px solid var(--border);
  }

  .code {
    padding: 0 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* per-kind tints */
  .added {
    background: color-mix(in srgb, #3fb950 16%, transparent);
  }
  .removed {
    background: color-mix(in srgb, #f85149 16%, transparent);
  }
  .changed {
    background: color-mix(in srgb, #d29922 16%, transparent);
  }

  .code mark {
    background: color-mix(in srgb, #d29922 45%, transparent);
    color: inherit;
    border-radius: 2px;
  }
</style>
