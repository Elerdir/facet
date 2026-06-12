<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import type { Orientation } from "../../domain/layout";

  let { splitId, orientation }: { splitId: string; orientation: Orientation } =
    $props();
  const ws = getWorkspace();

  let el: HTMLDivElement;
  let dragging = false;

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const container = el.parentElement;
    if (!container) return;
    const r = container.getBoundingClientRect();
    let fraction =
      orientation === "row"
        ? (e.clientX - r.left) / r.width
        : (e.clientY - r.top) / r.height;
    fraction = Math.min(0.85, Math.max(0.15, fraction));
    ws.layout.setSizes(splitId, [fraction, 1 - fraction]);
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released
    }
  }
</script>

<div
  class="splitter {orientation}"
  bind:this={el}
  role="separator"
  aria-orientation={orientation === "row" ? "vertical" : "horizontal"}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
></div>

<style>
  .splitter {
    flex: 0 0 auto;
    background: var(--border);
    z-index: 2;
  }

  .splitter.row {
    width: 5px;
    cursor: col-resize;
  }

  .splitter.column {
    height: 5px;
    cursor: row-resize;
  }

  .splitter:hover {
    background: var(--accent);
  }
</style>
