<script lang="ts">
  import {
    FolderOpen,
    FilePlus,
    FolderPlus,
    FolderPlus as AddRoot,
    ChevronRight,
    ChevronDown,
    X,
  } from "@lucide/svelte";
  import { getWorkspace } from "../../application/context";
  import TreeNode from "./TreeNode.svelte";
  import ContextMenu, { type MenuItem } from "../ContextMenu.svelte";
  import type { TreeNode as Node, RootFolder } from "../../application/explorer.svelte";
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

  function rootMenu(root: RootFolder, e: MouseEvent) {
    e.preventDefault();
    ctxMenu = {
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Nový soubor…", action: () => ws.promptNewFile(root.path) },
        { label: "Nová složka…", action: () => ws.promptNewFolder(root.path) },
        { separator: true },
        { label: "Odebrat z workspace", action: () => ws.removeWorkspaceFolder(root.path) },
      ],
    };
  }
</script>

<div class="explorer">
  <div class="header">
    <span class="title">Průzkumník</span>
    {#if ws.explorer.roots.length > 0}
      <button class="icon" title="Přidat složku do workspace" onclick={() => void ws.addFolderToWorkspace()}>
        <AddRoot size={14} />
      </button>
    {/if}
    <button class="icon" title="Otevřít složku (nahradit)" onclick={() => ws.openFolder()}>
      <FolderOpen size={14} />
    </button>
  </div>
  <div class="tree">
    {#if ws.explorer.roots.length === 0}
      <button class="open-folder" onclick={() => ws.openFolder()}>Otevřít složku…</button>
    {:else}
      {#each ws.explorer.roots as root (root.path)}
        <div class="root-row" oncontextmenu={(e) => rootMenu(root, e)} role="presentation">
          <button class="root-toggle" onclick={() => ws.explorer.toggleRoot(root)}>
            {#if root.expanded}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
            <span class="root-name">{root.name}</span>
          </button>
          <button class="root-act" title="Nový soubor" onclick={() => ws.promptNewFile(root.path)}>
            <FilePlus size={13} />
          </button>
          <button class="root-act" title="Nová složka" onclick={() => ws.promptNewFolder(root.path)}>
            <FolderPlus size={13} />
          </button>
          {#if ws.explorer.roots.length > 1}
            <button class="root-act" title="Odebrat z workspace" onclick={() => ws.removeWorkspaceFolder(root.path)}>
              <X size={13} />
            </button>
          {/if}
        </div>
        {#if root.expanded}
          {#each root.nodes as node (node.entry.path)}
            <TreeNode {node} depth={1} onContext={openNodeMenu} />
          {/each}
        {/if}
      {/each}
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

  .root-row {
    display: flex;
    align-items: center;
    height: 24px;
    padding-right: 6px;
  }

  .root-row:hover {
    background: var(--bg-elev-2);
  }

  .root-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--fg);
    cursor: pointer;
    padding: 0 4px 0 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .root-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .root-act {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .root-act:hover {
    background: var(--border);
    color: var(--fg);
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
