<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { symbolTrail, type DocSymbol } from "../../lsp/symbols";
  import { relativeTo } from "../../domain/paths";
  import type { Buffer } from "../../domain/buffer";

  let { buffer, active }: { buffer: Buffer | null; active: boolean } = $props();

  const ws = getWorkspace();

  const segments = $derived.by(() => {
    const path = buffer?.path;
    if (!path) return [buffer?.name ?? "bez názvu"];
    const root = ws.explorer.rootForPath(path) ?? ws.explorer.rootPath;
    const rel = root ? relativeTo(root, path) : path;
    return rel.split(/[\\/]/).filter((s) => s.length > 0);
  });

  let symbols = $state<DocSymbol[]>([]);
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Fetch symbols for the active editor only (breadcrumbs follow focus).
  $effect(() => {
    const path = active ? (buffer?.path ?? null) : null;
    void buffer?.content;
    if (timer) clearTimeout(timer);
    if (!path) {
      symbols = [];
      return;
    }
    timer = setTimeout(async () => {
      try {
        symbols = await ws.documentSymbols(path);
      } catch {
        symbols = [];
      }
    }, 350);
  });

  // editorStatus.line is 1-based and reflects the active editor's cursor.
  const trail = $derived(
    active && symbols.length > 0 ? symbolTrail(symbols, ws.editorStatus.line - 1) : [],
  );

  function jump(sym: DocSymbol) {
    if (buffer?.path) void ws.openAt(buffer.path, sym.line + 1);
  }
</script>

<div class="breadcrumbs">
  {#each segments as seg, i (i)}
    {#if i > 0}<span class="sep">›</span>{/if}
    <span class="seg path">{seg}</span>
  {/each}
  {#each trail as sym (sym.line + ":" + sym.name)}
    <span class="sep">›</span>
    <button class="seg sym" onclick={() => jump(sym)} title={sym.name}>{sym.name}</button>
  {/each}
</div>

<style>
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
    height: 24px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
  }

  .sep {
    color: var(--fg-dim);
    opacity: 0.7;
  }

  .seg {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .path {
    color: var(--fg-dim);
  }

  .path:last-of-type {
    color: var(--fg);
  }

  .sym {
    border: none;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    padding: 1px 3px;
    border-radius: 3px;
    font: inherit;
  }

  .sym:hover {
    background: var(--bg-elev-2);
  }
</style>
