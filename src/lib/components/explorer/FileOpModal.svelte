<script lang="ts">
  import { getWorkspace } from "../../application/context";

  const ws = getWorkspace();
  let value = $state("");

  // Reset the field whenever a new operation begins.
  $effect(() => {
    void ws.fileOpUi.op;
    value = ws.fileOpUi.initial;
  });

  function submit() {
    const name = value.trim();
    if (name === "") return;
    void ws.submitFileOp(name);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ws.fileOpUi.close();
    }
  }
</script>

{#if ws.fileOpUi.op}
  <div class="overlay">
    <button class="backdrop" aria-label="Zavřít" onclick={() => ws.fileOpUi.close()}></button>
    <div class="dialog" role="dialog" aria-modal="true">
      <div class="title">{ws.fileOpUi.title}</div>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value onkeydown={onKey} autofocus spellcheck="false" />
      <div class="actions">
        <button class="ghost" onclick={() => ws.fileOpUi.close()}>Zrušit</button>
        <button class="primary" onclick={submit} disabled={value.trim() === ""}>Potvrdit</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 110;
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

  .dialog {
    position: relative;
    width: min(440px, 90vw);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .title {
    font-size: 13px;
    color: var(--fg-dim);
  }

  input {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    padding: 9px 11px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions button {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 13px;
  }

  .ghost {
    background: transparent;
    color: var(--fg);
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
