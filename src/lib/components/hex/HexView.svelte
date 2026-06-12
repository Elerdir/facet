<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { formatHexRows, type HexRow } from "../../domain/hex";
  import type { Buffer } from "../../domain/buffer";

  // Windowed hex viewer: only the visible page is read from disk, so files of
  // any size open instantly. Mounted with {#key buffer.id} so each file starts
  // at offset 0.
  let { buffer }: { buffer: Buffer | null } = $props();
  const ws = getWorkspace();

  const PAGE = 4096; // 256 rows of 16 bytes

  let offset = $state(0);
  let rows = $state<HexRow[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const size = $derived(buffer?.size ?? 0);

  async function load() {
    if (!buffer?.path) return;
    loading = true;
    error = null;
    try {
      const bytes = await ws.readChunk(buffer.path, offset, PAGE);
      rows = formatHexRows(bytes, offset);
    } catch (e) {
      error = String(e);
      rows = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    offset; // re-read the window whenever the page changes
    void load();
  });

  function prev() {
    offset = Math.max(0, offset - PAGE);
  }
  function next() {
    if (offset + PAGE < size) offset += PAGE;
  }
</script>

<div class="hex">
  <div class="bar">
    <button onclick={prev} disabled={offset === 0}>◀</button>
    <span class="range">
      {offset.toLocaleString()}–{Math.min(offset + PAGE, size).toLocaleString()}
      / {size.toLocaleString()} B
    </span>
    <button onclick={next} disabled={offset + PAGE >= size}>▶</button>
    {#if loading}<span class="dim">načítám…</span>{/if}
    {#if error}<span class="err">{error}</span>{/if}
  </div>
  <div class="rows">
    {#each rows as row (row.offset)}
      <div class="row">
        <span class="off">{row.offset.toString(16).padStart(8, "0")}</span>
        <span class="bytes">{row.hex}</span>
        <span class="ascii">{row.ascii}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .hex {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 30px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
    color: var(--fg-dim);
    font-size: 12px;
    flex: 0 0 auto;
  }

  .bar button {
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    color: var(--fg);
    border-radius: 4px;
    padding: 1px 8px;
    cursor: pointer;
  }

  .bar button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .err {
    color: var(--danger);
  }

  .rows {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px 10px;
    font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 12.5px;
    line-height: 1.5;
    user-select: text;
  }

  .row {
    display: flex;
    gap: 18px;
    white-space: pre;
  }

  .off {
    color: var(--fg-dim);
  }

  .bytes {
    color: var(--fg);
  }

  .ascii {
    color: var(--accent);
  }
</style>
