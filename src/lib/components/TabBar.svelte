<script lang="ts">
  import { X, Pin } from "@lucide/svelte";
  import { getWorkspace } from "../application/context";
  import { isDirty } from "../domain/buffer";
  import ContextMenu, { type MenuItem } from "./ContextMenu.svelte";
  import type { PaneLeaf } from "../domain/layout";

  let { leaf }: { leaf: PaneLeaf } = $props();
  const ws = getWorkspace();

  // Pinned tabs render first (stable within each group).
  const orderedTabs = $derived(
    [...leaf.tabs].sort((a, b) => Number(ws.layout.isPinned(b)) - Number(ws.layout.isPinned(a))),
  );

  let ctxMenu = $state<{ x: number; y: number; tabId: string } | null>(null);

  function tabMenu(tabId: string): MenuItem[] {
    return [
      {
        label: ws.layout.isPinned(tabId) ? "Odepnout" : "Připnout",
        action: () => ws.layout.togglePin(tabId),
      },
      { label: "Zavřít", action: () => void ws.closeTab(leaf.id, tabId) },
    ];
  }
</script>

<div
  class="tabbar"
  role="tablist"
  tabindex="-1"
  ondragover={(e) => {
    if (e.dataTransfer?.types.includes("application/x-facet-tab")) e.preventDefault();
  }}
  ondrop={(e) => {
    const raw = e.dataTransfer?.getData("application/x-facet-tab");
    if (!raw) return;
    e.preventDefault();
    try {
      const { tabId, fromLeafId } = JSON.parse(raw) as { tabId: string; fromLeafId: string };
      ws.layout.moveTab(fromLeafId, tabId, leaf.id); // na konec
    } catch {
      // cizí drop — ignorovat
    }
  }}
>
  {#each orderedTabs as tabId, tabIndex (tabId)}
    {@const buf = ws.buffers.get(tabId)}
    {#if buf}
      <div
        class="tab"
        class:active={tabId === leaf.activeTab}
        class:pinned={ws.layout.isPinned(tabId)}
        role="button"
        tabindex="0"
        title={buf.path ?? buf.name}
        oncontextmenu={(e) => {
          e.preventDefault();
          ctxMenu = { x: e.clientX, y: e.clientY, tabId };
        }}
        draggable="true"
        ondragstart={(e) => {
          e.dataTransfer?.setData(
            "application/x-facet-tab",
            JSON.stringify({ tabId, fromLeafId: leaf.id }),
          );
        }}
        ondragover={(e) => {
          if (e.dataTransfer?.types.includes("application/x-facet-tab")) e.preventDefault();
        }}
        ondrop={(e) => {
          const raw = e.dataTransfer?.getData("application/x-facet-tab");
          if (!raw) return;
          e.preventDefault();
          e.stopPropagation();
          try {
            const data = JSON.parse(raw) as { tabId: string; fromLeafId: string };
            ws.layout.moveTab(data.fromLeafId, data.tabId, leaf.id, tabIndex);
          } catch {
            // cizí drop — ignorovat
          }
        }}
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
        {#if ws.layout.isPinned(tabId)}
          <button
            class="close pin"
            title="Odepnout"
            onclick={(e) => {
              e.stopPropagation();
              ws.layout.togglePin(tabId);
            }}
          >
            <Pin size={11} />
          </button>
        {:else}
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
        {/if}
      </div>
    {/if}
  {/each}
</div>

{#if ctxMenu}
  <ContextMenu
    x={ctxMenu.x}
    y={ctxMenu.y}
    items={tabMenu(ctxMenu.tabId)}
    onClose={() => (ctxMenu = null)}
  />
{/if}

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

  .tab.pinned .name {
    font-style: italic;
  }

  .close.pin {
    color: var(--accent);
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
