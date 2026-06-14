<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { hunkLineKind, type ParsedFileDiff, type DiffHunk } from "../../domain/diffHunks";

  const ws = getWorkspace();
  const file = $derived(ws.hunkUi.file);

  let parsed = $state<ParsedFileDiff | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function reload() {
    if (!file) return;
    loading = true;
    error = null;
    try {
      parsed = await ws.fileHunks(file);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void file; // re-run when the targeted file changes
    void reload();
  });

  async function stage(hunks: DiffHunk[]) {
    if (!parsed) return;
    try {
      await ws.stageHunks(parsed.fileHeader, hunks);
      await reload();
      // Nothing left unstaged → close.
      if (parsed && parsed.hunks.length === 0) ws.hunkUi.close();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      ws.hunkUi.close();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={() => ws.hunkUi.close()}></button>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="head">
      <span>Připravit po blocích — {file}</span>
      <span class="grow"></span>
      {#if parsed && parsed.hunks.length > 0}
        <button class="btn" onclick={() => stage(parsed!.hunks)}>Připravit vše</button>
      {/if}
      <button class="x" aria-label="Zavřít (Esc)" onclick={() => ws.hunkUi.close()}>✕</button>
    </div>

    <div class="body">
      {#if loading}
        <div class="note">Načítám…</div>
      {:else if error}
        <div class="note err">{error}</div>
      {:else if !parsed || parsed.hunks.length === 0}
        <div class="note">Žádné nepřipravené změny v tomto souboru.</div>
      {:else}
        {#each parsed.hunks as hunk (hunk.id)}
          <div class="hunk">
            <div class="hunk-head">
              <span class="hh">{hunk.header}</span>
              <button class="btn small" onclick={() => stage([hunk])}>Připravit blok</button>
            </div>
            <pre class="hunk-body">{#each hunk.text.split("\n").slice(1) as line, i (i)}{#if line !== ""}<span
                    class="ln {hunkLineKind(line)}">{line}</span>{/if}{/each}</pre>
          </div>
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
    max-height: 80vh;
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
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .note {
    color: var(--fg-dim);
    font-size: 13px;
    padding: 8px;
  }

  .note.err {
    color: var(--danger);
    white-space: pre-wrap;
  }

  .hunk {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .hunk-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: var(--bg-elev-2);
    border-bottom: 1px solid var(--border);
  }

  .hh {
    flex: 1;
    font-family: "Cascadia Code", Consolas, monospace;
    font-size: 12px;
    color: var(--accent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hunk-body {
    margin: 0;
    padding: 6px 0;
    background: var(--bg);
    overflow-x: auto;
    font-family: "Cascadia Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .ln {
    display: block;
    padding: 0 10px;
    white-space: pre;
  }

  .ln.add {
    background: color-mix(in srgb, #3fb950 16%, transparent);
  }

  .ln.del {
    background: color-mix(in srgb, #f85149 16%, transparent);
  }

  .ln.meta {
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

  .btn.small {
    padding: 3px 10px;
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
</style>
