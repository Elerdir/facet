<script lang="ts">
  import PaneContent from "./PaneContent.svelte";
  import Splitter from "./Splitter.svelte";
  import Self from "./PaneView.svelte";
  import type { LayoutNode } from "../../domain/layout";

  let { node }: { node: LayoutNode } = $props();
</script>

{#if node.kind === "leaf"}
  <PaneContent leaf={node} />
{:else}
  <div class="split {node.orientation}">
    <div class="cell" style="flex-grow: {node.sizes[0]}">
      <Self node={node.children[0]} />
    </div>
    <Splitter splitId={node.id} orientation={node.orientation} />
    <div class="cell" style="flex-grow: {node.sizes[1]}">
      <Self node={node.children[1]} />
    </div>
  </div>
{/if}

<style>
  .split {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    display: flex;
  }

  .split.row {
    flex-direction: row;
  }

  .split.column {
    flex-direction: column;
  }

  .cell {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-basis: 0;
    overflow: hidden;
  }
</style>
