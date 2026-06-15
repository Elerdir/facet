<script lang="ts">
  import { getWorkspace } from "../../application/context";
  import { adapterForFile } from "../../dap/adapters";
  import { Play, Square, Pause, ChevronsRight } from "@lucide/svelte";

  const ws = getWorkspace();
  const dbg = ws.debug;

  const activeBuf = $derived(ws.activeBuffer());
  const adapter = $derived(activeBuf?.path ? adapterForFile(activeBuf.name) : null);
  const canStart = $derived(!dbg.active && adapter !== null);

  const stateLabel = $derived(
    {
      inactive: "Neaktivní",
      starting: "Spouštím…",
      running: "Běží",
      stopped: "Zastaveno",
      terminated: "Ukončeno",
    }[dbg.state],
  );

  function base(path: string): string {
    return path.split(/[\\/]/).pop() ?? path;
  }
</script>

<div class="debug">
  <div class="header"><span class="title">Ladění</span><span class="state">{stateLabel}</span></div>

  <div class="controls">
    {#if dbg.active}
      <button title="Pokračovat (F5)" onclick={() => dbg.continue()} disabled={dbg.state !== "stopped"}>
        <ChevronsRight size={15} />
      </button>
      <button title="Přerušit" onclick={() => dbg.pause()} disabled={dbg.state !== "running"}>
        <Pause size={15} />
      </button>
      <button class="txt" onclick={() => dbg.next()} disabled={dbg.state !== "stopped"}>Překročit</button>
      <button class="txt" onclick={() => dbg.stepIn()} disabled={dbg.state !== "stopped"}>Vstoupit</button>
      <button class="txt" onclick={() => dbg.stepOut()} disabled={dbg.state !== "stopped"}>Vystoupit</button>
      <button class="stop" title="Zastavit" onclick={() => void ws.stopDebugging()}>
        <Square size={14} />
      </button>
    {:else}
      <button class="start" disabled={!canStart} onclick={() => void ws.startDebugging()}>
        <Play size={14} /> Spustit ladění
      </button>
    {/if}
  </div>

  {#if dbg.error}
    <div class="error">{dbg.error}</div>
  {:else if !dbg.active && !adapter}
    <div class="hint">
      Otevři soubor s podporovaným ladicím adaptérem (Python/debugpy, Go/Delve,
      Rust·C/C++/lldb-dap). Adaptér musí být nainstalovaný.
    </div>
  {/if}

  <div class="sections">
    {#if dbg.frames.length > 0}
      <section>
        <div class="sec-title">Zásobník volání</div>
        {#each dbg.frames as f (f.id)}
          <button
            class="row frame"
            class:active={f.id === dbg.currentFrameId}
            onclick={() => void dbg.selectFrame(f.id)}
          >
            <span class="name">{f.name}</span>
            {#if f.path}<span class="loc">{base(f.path)}:{f.line}</span>{/if}
          </button>
        {/each}
      </section>
    {/if}

    {#if dbg.scopes.length > 0}
      <section>
        <div class="sec-title">Proměnné</div>
        {#each dbg.scopes as scope (scope.name)}
          <div class="scope">{scope.name}</div>
          {#each scope.variables as v (scope.name + ":" + v.name)}
            <div class="row var">
              <span class="vname">{v.name}</span>
              <span class="vval" title={v.value}>{v.value}</span>
            </div>
          {/each}
        {/each}
      </section>
    {/if}

    <section>
      <div class="sec-title">Body přerušení</div>
      {#if ws.breakpoints.list.length === 0}
        <div class="empty">Žádné. Klikni do okraje editoru.</div>
      {:else}
        {#each ws.breakpoints.list as bp (bp.path + ":" + bp.line)}
          <div class="row bp">
            <button class="bp-open" onclick={() => void ws.openAt(bp.path, bp.line)}>
              <span class="dot"></span>
              <span class="name">{base(bp.path)}:{bp.line}</span>
            </button>
            <button class="rm" title="Odebrat" onclick={() => ws.toggleBreakpoint(bp.path, bp.line)}>✕</button>
          </div>
        {/each}
      {/if}
    </section>

    {#if dbg.output.length > 0}
      <section>
        <div class="sec-title">Výstup</div>
        <div class="console">
          {#each dbg.output as line, i (i)}<span class="out {line.category}">{line.text}</span>{/each}
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .debug {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }

  .state {
    font-size: 11px;
    color: var(--fg-dim);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }

  .controls button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--border);
    background: var(--bg-elev);
    color: var(--fg);
    border-radius: 4px;
    padding: 3px 7px;
    font-size: 12px;
    cursor: pointer;
  }

  .controls button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .controls button:not(:disabled):hover {
    background: var(--bg-elev-2);
  }

  .controls .start {
    color: #3fb950;
  }

  .controls .stop {
    color: #f85149;
  }

  .error {
    margin: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, #f85149 14%, transparent);
    color: #f85149;
    font-size: 12px;
  }

  .hint {
    margin: 8px;
    color: var(--fg-dim);
    font-size: 12px;
    line-height: 1.4;
  }

  .sections {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  section {
    border-bottom: 1px solid var(--border);
    padding: 4px 0 6px;
  }

  .sec-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-dim);
    padding: 4px 10px;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 2px 10px;
    font-size: 12.5px;
  }

  button.row {
    border: none;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }

  button.row:hover {
    background: var(--bg-elev-2);
  }

  .frame.active {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .frame .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loc {
    margin-left: auto;
    color: var(--fg-dim);
    font-size: 11px;
  }

  .scope {
    padding: 4px 10px 1px;
    font-size: 11px;
    color: var(--fg-dim);
  }

  .var {
    font-family: var(--editor-font, monospace);
    font-size: 12px;
  }

  .vname {
    color: var(--accent);
  }

  .vval {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg);
  }

  .bp {
    justify-content: space-between;
    padding: 0 6px 0 10px;
  }

  .bp-open {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    border: none;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
    padding: 3px 0;
    font-size: 12.5px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f85149;
    flex: 0 0 auto;
  }

  .rm {
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 11px;
  }

  .rm:hover {
    color: var(--fg);
  }

  .empty {
    padding: 4px 10px;
    color: var(--fg-dim);
    font-size: 12px;
  }

  .console {
    padding: 4px 10px;
    font-family: var(--editor-font, monospace);
    font-size: 11.5px;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 180px;
    overflow: auto;
  }

  .out.stderr {
    color: #f85149;
  }
</style>
