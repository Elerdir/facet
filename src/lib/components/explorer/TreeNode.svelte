<script lang="ts">
  import { ChevronRight, ChevronDown, File, Folder } from "@lucide/svelte";
  import { getWorkspace } from "../../application/context";
  import type { TreeNode } from "../../application/explorer.svelte";
  import Self from "./TreeNode.svelte";

  let {
    node,
    depth,
    onContext,
  }: {
    node: TreeNode;
    depth: number;
    onContext: (node: TreeNode, x: number, y: number) => void;
  } = $props();
  const ws = getWorkspace();

  function activate() {
    if (node.entry.isDir) ws.explorer.toggle(node);
    else ws.openPath(node.entry.path);
  }
</script>

<div
  class="row"
  style="padding-left: {depth * 12 + 6}px"
  role="button"
  tabindex="0"
  onclick={activate}
  oncontextmenu={(e) => {
    e.preventDefault();
    e.stopPropagation();
    onContext(node, e.clientX, e.clientY);
  }}
  onkeydown={(e) => e.key === "Enter" && activate()}
>
  {#if node.entry.isDir}
    {#if node.expanded}
      <ChevronDown size={14} />
    {:else}
      <ChevronRight size={14} />
    {/if}
    <Folder size={14} />
  {:else}
    <span class="chev-spacer"></span>
    <File size={14} />
  {/if}
  <span class="label">{node.entry.name}</span>
</div>

{#if node.entry.isDir && node.expanded && node.children}
  {#each node.children as child (child.entry.path)}
    <Self node={child} depth={depth + 1} {onContext} />
  {/each}
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding-right: 8px;
    color: var(--fg);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .row:hover {
    background: var(--bg-elev-2);
  }

  .chev-spacer {
    display: inline-block;
    width: 14px;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
