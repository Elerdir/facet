<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { lineDiff, type LineOpKind } from "../../domain/lineDiff";
  import { stripCodeFences } from "../../domain/ai";

  const sign = (kind: LineOpKind): string =>
    kind === "add" ? "+" : kind === "del" ? "-" : " ";

  const ws = getWorkspace();
  const ie = ws.inlineEdit;

  const diff = $derived(
    ie.target && ie.status === "review"
      ? lineDiff(ie.target.original, stripCodeFences(ie.generated))
      : [],
  );

  function onPromptKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ws.runInlineEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ie.close();
    }
  }

  function onWindowKey(e: KeyboardEvent) {
    if (ie.status === "review") {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        ws.acceptInlineEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        ie.close();
      }
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="wrap">
  <div class="panel">
    <div class="head">
      <span class="title">Inline úprava</span>
      <span class="file">{ie.target?.fileName}</span>
      <span class="grow"></span>
      <button class="x" title="Zavřít (Esc)" onclick={() => ie.close()}>✕</button>
    </div>

    {#if ie.status === "prompt" || ie.status === "generating"}
      <textarea
        rows="2"
        placeholder="Co s vybraným kódem udělat? Např. přidej ošetření chyb, převeď na async…"
        bind:value={ie.instruction}
        onkeydown={onPromptKey}
        disabled={ie.status === "generating"}
      ></textarea>
      <div class="row">
        <span class="hint">Enter generuje · Esc zavře</span>
        <span class="grow"></span>
        <button
          class="btn primary"
          disabled={ie.instruction.trim() === "" || ie.status === "generating"}
          onclick={() => void ws.runInlineEdit()}
        >
          {ie.status === "generating" ? "Generuji…" : "Generovat"}
        </button>
      </div>
      {#if ie.status === "generating" && ie.generated}
        <pre class="stream">{stripCodeFences(ie.generated)}</pre>
      {/if}
    {:else if ie.status === "review"}
      <div class="diff">
        {#each diff as op, i (i)}
          <div class="dl {op.kind}">
            <span class="sign">{sign(op.kind)}</span>
            <span class="dtext">{op.text}</span>
          </div>
        {/each}
      </div>
      <div class="row">
        <button class="btn" onclick={() => (ie.status = "prompt")}>Přegenerovat</button>
        <span class="grow"></span>
        <button class="btn" onclick={() => ie.close()}>Zamítnout</button>
        <button class="btn primary" onclick={() => ws.acceptInlineEdit()}>
          Přijmout (Ctrl+Enter)
        </button>
      </div>
    {:else}
      <div class="err">{ie.error}</div>
      <div class="row">
        <span class="grow"></span>
        <button class="btn" onclick={() => (ie.status = "prompt")}>Zkusit znovu</button>
        <button class="btn" onclick={() => ie.close()}>Zavřít</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .wrap {
    position: fixed;
    top: 52px;
    left: 0;
    right: 0;
    z-index: 80;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .panel {
    pointer-events: auto;
    width: min(640px, 90vw);
    background: var(--bg-elev);
    border: 1px solid var(--accent);
    border-radius: 10px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
  }

  .file {
    font-size: 12px;
    color: var(--fg-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grow {
    flex: 1;
  }

  .x {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .x:hover {
    color: var(--fg);
  }

  textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
    outline: none;
  }

  textarea:focus {
    border-color: var(--accent);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hint {
    font-size: 11px;
    color: var(--fg-dim);
  }

  .btn {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elev-2);
    color: var(--fg);
    padding: 5px 12px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
  }

  .btn.primary {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .stream,
  .diff {
    max-height: 46vh;
    overflow: auto;
    margin: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: "Cascadia Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .stream {
    padding: 8px 10px;
    white-space: pre-wrap;
  }

  .diff {
    padding: 4px 0;
  }

  .dl {
    display: flex;
    padding: 0 8px;
    white-space: pre;
  }

  .dl .sign {
    width: 1.2em;
    flex: 0 0 auto;
    color: var(--fg-dim);
  }

  .dl .dtext {
    flex: 1;
  }

  .dl.add {
    background: color-mix(in srgb, #3fb950 16%, transparent);
  }

  .dl.del {
    background: color-mix(in srgb, #f85149 16%, transparent);
  }

  .err {
    color: var(--danger);
    font-size: 12px;
    white-space: pre-wrap;
  }
</style>
