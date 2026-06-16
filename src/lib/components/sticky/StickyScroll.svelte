<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { symbolTrail, type DocSymbol } from "../../lsp/symbols";
  import type { Buffer } from "../../domain/buffer";

  let {
    buffer,
    topLine,
  }: { buffer: Buffer | null; topLine: number } = $props();

  const ws = getWorkspace();

  let symbols = $state<DocSymbol[]>([]);
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const path = buffer?.path ?? null;
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

  // Enclosing symbols whose declaration has scrolled above the top edge.
  const headers = $derived(
    symbols.length > 0
      ? symbolTrail(symbols, topLine - 1).filter((s) => s.line < topLine - 1)
      : [],
  );

  const lines = $derived(buffer?.content.split("\n") ?? []);

  function lineText(sym: DocSymbol): string {
    return (lines[sym.line] ?? sym.name).trimEnd();
  }

  function jump(sym: DocSymbol) {
    if (buffer?.path) void ws.openAt(buffer.path, sym.line + 1);
  }
</script>

{#if headers.length > 0}
  <div class="sticky">
    {#each headers as sym, i (sym.line + ":" + i)}
      <button
        class="line"
        style="padding-left: {10 + i * 12}px"
        onclick={() => jump(sym)}
        title="Přejít na {sym.name}"
      >
        {lineText(sym)}
      </button>
    {/each}
  </div>
{/if}

<style>
  .sticky {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .line {
    display: block;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
    padding: 1px 10px;
    font-family: var(--editor-font, "Cascadia Code", Consolas, monospace);
    font-size: var(--editor-font-size, 13px);
    line-height: 1.5;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .line:hover {
    background: var(--bg-elev-2);
  }
</style>
