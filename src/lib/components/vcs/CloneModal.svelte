<script lang="ts">
  import { getWorkspace } from "../../application/context";

  const ws = getWorkspace();
  let url = $state("");
  let busy = $state(false);
  let message = $state("");
  let error = $state(false);

  async function clone() {
    if (!url.trim() || busy) return;
    busy = true;
    error = false;
    message = "Vyber cílovou složku…";
    try {
      const target = await ws.cloneRepo(url.trim());
      message = `Naklonováno do ${target}`;
      url = "";
      setTimeout(() => ws.cloneUi.close(), 900);
    } catch (e) {
      error = true;
      message = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void clone();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ws.cloneUi.close();
    }
  }
</script>

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={() => ws.cloneUi.close()}></button>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="head">Klonovat repozitář</div>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      placeholder="https://github.com/uživatel/repo.git"
      bind:value={url}
      onkeydown={onKey}
      autofocus
      disabled={busy}
    />
    <div class="hint">
      Vložíš adresu, vybereš cílovou složku a Facet repo naklonuje a otevře.
      Pro soukromé repozitáře se použije token z Nastavení → Git.
    </div>
    {#if message}<div class="msg" class:err={error}>{message}</div>{/if}
    <div class="actions">
      <button class="secondary" onclick={() => ws.cloneUi.close()}>Zrušit</button>
      <button class="primary" disabled={!url.trim() || busy} onclick={clone}>
        {busy ? "Klonuji…" : "Klonovat"}
      </button>
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
    padding-top: 16vh;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
  }

  .modal {
    position: relative;
    width: min(460px, 92vw);
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    padding: 14px;
  }

  .head {
    font-weight: 600;
  }

  input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 13px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .hint {
    color: var(--fg-dim);
    font-size: 12px;
  }

  .msg {
    font-size: 12px;
    color: var(--fg-dim);
    white-space: pre-wrap;
  }

  .msg.err {
    color: var(--danger);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions button {
    border-radius: 6px;
    padding: 6px 14px;
    cursor: pointer;
    font-family: inherit;
  }

  .secondary {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--fg);
  }

  .primary {
    border: 1px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--fg);
  }

  .primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
