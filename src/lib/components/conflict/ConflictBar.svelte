<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { parseConflicts, conflictAtLine } from "../../domain/conflicts";
  import type { Buffer } from "../../domain/buffer";

  let { buffer, active }: { buffer: Buffer | null; active: boolean } = $props();

  const ws = getWorkspace();
  const conflicts = $derived(buffer && !buffer.binary ? parseConflicts(buffer.content) : []);
  const current = $derived(
    conflicts.length > 0 ? conflictAtLine(conflicts, active ? ws.editorStatus.line - 1 : 0) : 0,
  );

  function resolve(choice: "current" | "incoming" | "both") {
    ws.resolveConflict(current, choice);
  }

  function next() {
    if (conflicts.length === 0) return;
    const after = conflicts.find((c) => c.startLine > ws.editorStatus.line - 1) ?? conflicts[0];
    ws.gotoLine(after.startLine + 1);
  }
</script>

{#if conflicts.length > 0}
  <div class="conflict-bar">
    <span class="lbl">Konflikt {current + 1}/{conflicts.length}</span>
    <button class="cur" onclick={() => resolve("current")}>Aktuální</button>
    <button class="inc" onclick={() => resolve("incoming")}>Příchozí</button>
    <button onclick={() => resolve("both")}>Obě</button>
    {#if conflicts.length > 1}
      <button class="nav" onclick={next}>Další ›</button>
    {/if}
  </div>
{/if}

<style>
  .conflict-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
    padding: 4px 10px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, #f85149 12%, var(--bg-elev));
    font-size: 12px;
  }

  .lbl {
    color: var(--fg-dim);
    margin-right: 4px;
  }

  .conflict-bar button {
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    color: var(--fg);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .conflict-bar button:hover {
    border-color: var(--accent);
  }

  .cur {
    color: #4aa3ff;
  }

  .inc {
    color: #3fb950;
  }

  .nav {
    margin-left: auto;
  }
</style>
