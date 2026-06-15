<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { lineDiff, type LineOpKind } from "../../domain/lineDiff";

  const ws = getWorkspace();
  const ui = ws.projectEditUi;

  const sign = (k: LineOpKind): string => (k === "add" ? "+" : k === "del" ? "-" : " ");

  const openCount = $derived(
    ws.buffers.items.filter((b) => !b.binary && b.path).length,
  );
  const applicable = $derived(ui.results.filter((r) => r.ok));

  function onPromptKey(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void ws.runProjectEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ui.close();
    }
  }
</script>

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={() => ui.close()}></button>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="head">
      <span>AI úprava napříč soubory</span>
      <span class="grow"></span>
      <button class="x" aria-label="Zavřít (Esc)" onclick={() => ui.close()}>✕</button>
    </div>

    <div class="body">
      {#if ui.status === "prompt" || ui.status === "generating"}
        <div class="ctx">Kontext: {openCount} otevřených souborů</div>
        <textarea
          rows="3"
          placeholder="Co změnit napříč otevřenými soubory? Např. přejmenuj funkci foo na bar, přidej typy…"
          bind:value={ui.instruction}
          onkeydown={onPromptKey}
          disabled={ui.status === "generating"}
        ></textarea>
        <div class="row">
          <span class="hint">Ctrl+Enter generuje · Esc zavře</span>
          <span class="grow"></span>
          <button
            class="btn primary"
            disabled={ui.instruction.trim() === "" || ui.status === "generating" || openCount === 0}
            onclick={() => void ws.runProjectEdit()}
          >
            {ui.status === "generating" ? "Generuji…" : "Navrhnout změny"}
          </button>
        </div>
        {#if ui.status === "generating"}
          <pre class="stream">{ui.raw}</pre>
        {/if}
      {:else if ui.status === "review"}
        {#if applicable.length === 0}
          <div class="note">AI nenavrhla žádné aplikovatelné změny.</div>
          <pre class="stream">{ui.raw}</pre>
        {:else}
          <div class="note">Návrh změn v {applicable.length} souborech:</div>
        {/if}
        {#each ui.results as r (r.path)}
          <div class="file">
            <div class="file-head" class:bad={!r.ok}>
              <span class="fp">{r.path}</span>
              {#if !r.ok}<span class="badge">neuplatněno (úsek nenalezen)</span>{/if}
            </div>
            {#if r.ok}
              <div class="diff">
                {#each lineDiff(r.before, r.after) as op, i (i)}
                  {#if op.kind !== "same"}
                    <div class="dl {op.kind}">
                      <span class="s">{sign(op.kind)}</span>
                      <span class="t">{op.text}</span>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
        <div class="row sticky">
          <button class="btn" onclick={() => (ui.status = "prompt")}>Přegenerovat</button>
          <span class="grow"></span>
          <button class="btn" onclick={() => ui.close()}>Zamítnout</button>
          <button
            class="btn primary"
            disabled={applicable.length === 0}
            onclick={() => ws.acceptProjectEdit()}
          >
            Přijmout {applicable.length} souborů
          </button>
        </div>
      {:else}
        <div class="err">{ui.error}</div>
        <div class="row">
          <span class="grow"></span>
          <button class="btn" onclick={() => (ui.status = "prompt")}>Zpět</button>
          <button class="btn" onclick={() => ui.close()}>Zavřít</button>
        </div>
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
    padding-top: 8vh;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0, 0, 0, 0.45);
    cursor: default;
  }

  .modal {
    position: relative;
    width: min(760px, 94vw);
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    flex: 0 0 auto;
  }

  .grow {
    flex: 1;
  }

  .x {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 14px;
  }

  .x:hover {
    color: var(--fg);
  }

  .body {
    overflow: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ctx,
  .note {
    color: var(--fg-dim);
    font-size: 12px;
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

  .row.sticky {
    position: sticky;
    bottom: 0;
    background: var(--bg-elev);
    padding-top: 8px;
    border-top: 1px solid var(--border);
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

  .file {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .file-head {
    padding: 5px 10px;
    background: var(--bg-elev-2);
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-head.bad {
    color: var(--fg-dim);
  }

  .fp {
    flex: 1;
    font-family: "Cascadia Code", Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    color: var(--danger);
    font-size: 11px;
  }

  .diff {
    max-height: 28vh;
    overflow: auto;
    background: var(--bg);
    padding: 4px 0;
    font-family: "Cascadia Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .dl {
    display: flex;
    padding: 0 8px;
    white-space: pre;
  }

  .dl .s {
    width: 1.2em;
    flex: 0 0 auto;
    color: var(--fg-dim);
  }

  .dl .t {
    flex: 1;
  }

  .dl.add {
    background: color-mix(in srgb, #3fb950 16%, transparent);
  }

  .dl.del {
    background: color-mix(in srgb, #f85149 16%, transparent);
  }

  .stream {
    max-height: 40vh;
    overflow: auto;
    margin: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: "Cascadia Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .err {
    color: var(--danger);
    font-size: 12px;
    white-space: pre-wrap;
  }
</style>
