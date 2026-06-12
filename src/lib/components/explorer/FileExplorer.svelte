<script lang="ts">
  import { FolderOpen } from "@lucide/svelte";
  import { getWorkspace } from "../../application/context";
  import TreeNode from "./TreeNode.svelte";

  const ws = getWorkspace();
</script>

<div class="explorer">
  <div class="header">
    <span class="title">{ws.explorer.rootName || "Průzkumník"}</span>
    <button class="icon" title="Otevřít složku" onclick={() => ws.openFolder()}>
      <FolderOpen size={14} />
    </button>
  </div>
  <div class="tree">
    {#if ws.explorer.rootPath}
      {#each ws.explorer.nodes as node (node.entry.path)}
        <TreeNode {node} depth={0} />
      {/each}
    {:else}
      <button class="open-folder" onclick={() => ws.openFolder()}>
        Otevřít složku…
      </button>
    {/if}
  </div>
</div>

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
