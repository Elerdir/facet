<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { AI_MODELS } from "../../domain/ai";

  let { onClose }: { onClose: () => void } = $props();

  const ws = getWorkspace();
  const s = $derived(ws.settings.current);

  function setRetention(days: number) {
    ws.settings.update({ historyRetentionDays: days });
    ws.history.setRetentionDays(days);
  }
</script>

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={onClose}></button>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="head">
      <span>Nastavení</span>
      <button class="x" aria-label="Zavřít" onclick={onClose}>✕</button>
    </div>

    <label class="row">
      <input
        type="checkbox"
        checked={s.autosaveEnabled}
        onchange={(e) => ws.settings.update({ autosaveEnabled: e.currentTarget.checked })}
      />
      <span>Automatické ukládání</span>
    </label>

    <label class="row">
      <span>Interval autosave (s)</span>
      <input
        type="number"
        min="5"
        max="3600"
        value={s.autosaveSeconds}
        onchange={(e) => ws.settings.update({ autosaveSeconds: Number(e.currentTarget.value) })}
      />
    </label>

    <label class="row">
      <span>Historie – retence (dny)</span>
      <input
        type="number"
        min="1"
        max="365"
        value={s.historyRetentionDays}
        onchange={(e) => setRetention(Number(e.currentTarget.value))}
      />
    </label>

    <label class="row">
      <span>Motiv</span>
      <select
        value={s.theme}
        onchange={(e) => ws.settings.update({ theme: e.currentTarget.value === "light" ? "light" : "dark" })}
      >
        <option value="dark">Tmavý</option>
        <option value="light">Světlý</option>
      </select>
    </label>

    <label class="row">
      <input
        type="checkbox"
        checked={s.lspEnabled}
        onchange={(e) => ws.settings.update({ lspEnabled: e.currentTarget.checked })}
      />
      <span>Jazykové služby (LSP)</span>
    </label>

    <div class="section">AI asistent (Claude)</div>

    <label class="row">
      <span>API klíč</span>
      <input
        type="password"
        class="wide"
        placeholder="sk-ant-…"
        value={s.aiApiKey}
        onchange={(e) => ws.settings.update({ aiApiKey: e.currentTarget.value })}
      />
    </label>

    <label class="row">
      <span>Model</span>
      <select
        class="wide"
        value={s.aiModel}
        onchange={(e) => ws.settings.update({ aiModel: e.currentTarget.value })}
      >
        {#each AI_MODELS as m (m.id)}
          <option value={m.id}>{m.label}</option>
        {/each}
      </select>
    </label>
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
    padding-top: 14vh;
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
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    padding: 4px 0 12px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
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

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    color: var(--fg);
    font-size: 13px;
  }

  .row input[type="number"],
  .row select {
    width: 110px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 5px 8px;
    font-family: inherit;
  }

  .row input[type="checkbox"] {
    margin-right: auto;
  }

  .row .wide {
    width: 220px;
  }

  .section {
    padding: 12px 16px 2px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
    border-top: 1px solid var(--border);
    margin-top: 6px;
  }
</style>
