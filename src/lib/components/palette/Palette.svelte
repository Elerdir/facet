<script lang="ts">
  import { fuzzyFilter } from "../../domain/fuzzy";

  interface Item {
    id: string;
    label: string;
    hint?: string;
  }

  let { placeholder, items, onPick, onClose }: {
    placeholder: string;
    items: Item[];
    onPick: (id: string) => void;
    onClose: () => void;
  } = $props();

  let query = $state("");
  let index = $state(0);

  const filtered = $derived(
    fuzzyFilter(query, items, (i) => `${i.label} ${i.hint ?? ""}`, 100),
  );

  // Keep the selection in range as the result list changes.
  $effect(() => {
    if (index >= filtered.length) index = Math.max(0, filtered.length - 1);
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      index = Math.min(index + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      index = Math.max(index - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[index];
      if (item) onPick(item.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<div class="overlay">
  <button class="backdrop" aria-label="Zavřít" onclick={onClose}></button>
  <div class="palette" role="dialog" aria-modal="true">
    <!-- svelte-ignore a11y_autofocus -->
    <input {placeholder} bind:value={query} onkeydown={onKey} autofocus />
    <div class="list">
      {#each filtered as item, i (item.id)}
        <button
          class="item"
          class:sel={i === index}
          onclick={() => onPick(item.id)}
          onpointermove={() => (index = i)}
        >
          <span class="label">{item.label}</span>
          {#if item.hint}<span class="hint">{item.hint}</span>{/if}
        </button>
      {:else}
        <div class="none">Žádná shoda</div>
      {/each}
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
    padding-top: 12vh;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
  }

  .palette {
    position: relative;
    width: min(640px, 90vw);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  input {
    border: none;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--fg);
    padding: 12px 14px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
  }

  .list {
    overflow: auto;
    padding: 4px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--fg);
    padding: 8px 10px;
    cursor: pointer;
    text-align: left;
  }

  .item.sel {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    color: var(--fg-dim);
    font-size: 12px;
  }

  .none {
    padding: 12px;
    color: var(--fg-dim);
  }
</style>
