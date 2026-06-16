<script lang="ts">
  import { FolderOpen, FilePlus, FolderPlus } from "@lucide/svelte";
  import { getWorkspace } from "../../application/context";
  import TreeNode from "./TreeNode.svelte";
  import ContextMenu, { type MenuItem } from "../ContextMenu.svelte";
  import type { TreeNode as Node } from "../../application/explorer.svelte";
  import { dirname } from "../../domain/paths";

  const ws = getWorkspace();
  let ctxMenu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);

  function nodeItems(node: Node): MenuItem[] {
    const path = node.entry.path;
    const isDir = node.entry.isDir;
    const parent = isDir ? path : dirname(path);
    return [
      { label: "Nový soubor…", action: () => ws.promptNewFile(parent) },
      { label: "Nová složka…", action: () => ws.promptNewFolder(parent) },
      { separator: true },
      { label: "Přejmenovat…", action: () => ws.promptRename(path, isDir) },
      { label: "Přesunout do koše", action: () => void ws.deleteEntry(path, isDir) },
    ];
  }

  function openNodeMenu(node: Node, x: number, y: number) {
    ctxMenu = { x, y, items: nodeItems(node) };
  }

  function openRootMenu(e: MouseEvent) {
    const root = ws.explorer.rootPath;
    if (!root) return;
    e.preventDefault();
    ctxMenu = {
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Nový soubor…", action: () => ws.promptNewFile(root) },
        { label: "Nová složka…", action: () => ws.promptNewFolder(root) },
      ],
    };
  }
</script>

<div class="explorer">
  <div class="header">
    <span class="title">{ws.explorer.rootName || "Průzkumník"}</span>
    {#if ws.explorer.rootPath}
      <button
        class="icon"
        title="Nový soubor"
        onclick={() => ws.explorer.rootPath && ws.promptNewFile(ws.explorer.rootPath)}
      >
        <FilePlus size={14} />
      </button>
      <button
        class="icon"
        title="Nová složka"
        onclick={() => ws.explorer.rootPath && ws.promptNewFolder(ws.explorer.rootPath)}
      >
        <FolderPlus size={14} />
      </button>
    {/if}
    <button class="icon" title="Otevřít složku" onclick={() => ws.openFolder()}>
      <FolderOpen size={14} />
    </button>
  </div>
  <div
    class="tree"
    role="presentation"
    oncontextmenu={openRootMenu}
  >
    {#if ws.explorer.rootPath}
      {#each ws.explorer.nodes as node (node.entry.path)}
        <TreeNode {node} depth={0} onContext={openNodeMenu} />
      {/each}
    {:else}
      <button class="open-folder" onclick={() => ws.openFolder()}>
        Otevřít složku…
      </button>
    {/if}
  </div>
</div>

{#if ctxMenu}
  <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => (ctxMenu = null)} />
{/if}

<style>
  .explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 6px 0 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .title {
    flex: 1;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .tree {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
  }

  .open-folder {
    margin: 8px 10px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elev-2);
    color: var(--fg);
    cursor: pointer;
  }

  .open-folder:hover {
    border-color: var(--accent);
  }
</style>
