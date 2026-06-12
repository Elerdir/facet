<script lang="ts">
  import { getWorkspace } from "../../application/context";

  const ws = getWorkspace();
  let newName = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function confirm() {
    const req = ws.renameUi.request;
    if (!req || !newName.trim() || busy) return;
    busy = true;
    error = null;
    try {
      await ws.lspRename(req.path, req.line, req.character, newName.trim());
      ws.renameUi.close();
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void confirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ws.renameUi.close();
    }
  }
</script>

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={() => ws.renameUi.close()}></button>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="head">Přejmenovat symbol</div>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      placeholder="Nový název"
      bind:value={newName}
      onkeydown={onKey}
      autofocus
      disabled={busy}
    />
    {#if error}<div class="err">{error}</div>{/if}
    <div class="actions">
      <button class="secondary" onclick={() => ws.renameUi.close()}>Zrušit</button>
      <button class="primary" disabled={!newName.trim() || busy} onclick={confirm}>
        {busy ? "Přejmenovávám…" : "Přejmenovat"}
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
    padding-top: 18vh;
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
    width: min(380px, 92vw);
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

  .err {
    color: var(--danger);
    font-size: 12px;
    white-space: pre-wrap;
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
