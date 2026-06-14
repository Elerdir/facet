<script lang="ts">
  export interface MenuItem {
    label?: string;
    action?: () => void;
    separator?: boolean;
    disabled?: boolean;
    /** Non-clickable section label. */
    header?: boolean;
  }

  let { x, y, items, onClose }: {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
  } = $props();

  let menu: HTMLDivElement | undefined = $state();
  let size = $state({ w: 0, h: 0 });

  // Measure once mounted, then keep the menu inside the viewport.
  $effect(() => {
    if (menu) {
      const r = menu.getBoundingClientRect();
      size = { w: r.width, h: r.height };
    }
  });

  const left = $derived(Math.min(x, window.innerWidth - size.w - 6));
  const top = $derived(Math.min(y, window.innerHeight - size.h - 6));
</script>

<svelte:window onresize={onClose} />
<button class="scrim" aria-label="Zavřít" oncontextmenu={(e) => { e.preventDefault(); onClose(); }} onclick={onClose}></button>
<div class="menu" bind:this={menu} style="left: {left}px; top: {top}px" role="menu">
  {#each items as item, i (i)}
    {#if item.separator}
      <div class="sep"></div>
    {:else if item.header}
      <div class="header">{item.label}</div>
    {:else}
      <button
        class="item"
        role="menuitem"
        disabled={item.disabled}
        onclick={() => {
          item.action?.();
          onClose();
        }}
      >
        {item.label}
      </button>
    {/if}
  {/each}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
  }

  .menu {
    position: fixed;
    z-index: 91;
    min-width: 200px;
    padding: 4px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  }

  .item {
    border: none;
    background: transparent;
    color: var(--fg);
    text-align: left;
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    white-space: nowrap;
  }

  .item:hover:not(:disabled) {
    background: var(--bg-elev-2);
  }

  .item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .header {
    padding: 5px 10px 2px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }

  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }
</style>
