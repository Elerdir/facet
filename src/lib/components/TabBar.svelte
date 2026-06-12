<script lang="ts">
  import { X } from "@lucide/svelte";
  import { getWorkspace } from "../application/context";
  import { isDirty } from "../domain/buffer";
  import type { PaneLeaf } from "../domain/layout";

  let { leaf }: { leaf: PaneLeaf } = $props();
  const ws = getWorkspace();
</script>

<div class="tabbar">
  {#each leaf.tabs as tabId (tabId)}
    {@const buf = ws.buffers.get(tabId)}
    {#if buf}
      <div
        class="tab"
        class:active={tabId === leaf.activeTab}
        role="button"
        tabindex="0"
        title={buf.path ?? buf.name}
        onclick={() => ws.layout.setActiveTab(leaf.id, tabId)}
        onkeydown={(e) => e.key === "Enter" && ws.layout.setActiveTab(leaf.id, tabId)}
        onmousedown={(e) => {
          // Block the middle-click autoscroll cursor.
          if (e.button === 1) e.preventDefault();
        }}
        onauxclick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            void ws.closeTab(leaf.id, tabId);
          }
        }}
      >
        <span class="name">{buf.name}</span>
        {#if isDirty(buf)}
          <span class="dirty" title="Neuložené změny">●</span>
        {/if}
        <button
          class="close"
          title="Zavřít (Ctrl+W)"
          onclick={(e) => {
            e.stopPropagation();
            ws.closeTab(leaf.id, tabId);
          }}
        >
          <X size={12} />
        </button>
      </div>
    {/if}
  {/each}
</div>

<style>
  .tabbar {
    display: flex;
    align-items: stretch;
    height: 32px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex: 0 0 auto;
  }

  .tabbar::-webkit-scrollbar {
    height: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 12px;
    border-right: 1px solid var(--border);
    background: var(--bg-elev);
    color: var(--fg-dim);
    cursor: pointer;
    white-space: nowrap;
    max-width: 200px;
  }

  .tab:hover {
    background: var(--bg-elev-2);
  }

  .tab.active {
    background: var(--bg);
    color: var(--fg);
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dirty {
    color: var(--accent);
    font-size: 10px;
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .close:hover {
    background: var(--border);
    color: var(--fg);
  }
</style>
