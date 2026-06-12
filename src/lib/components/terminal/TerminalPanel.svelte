<script lang="ts">
  import { onMount } from "svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";
  import { X, RotateCcw } from "@lucide/svelte";
  import { TauriTerminal } from "../../infrastructure/tauriTerminal";
  import { getWorkspace } from "../../application/context";

  let { onClose }: { onClose: () => void } = $props();

  const ws = getWorkspace();
  const backend = new TauriTerminal();

  let host: HTMLDivElement;
  let shell = $state<"powershell" | "cmd">("powershell");
  let term: Terminal | null = null;
  let fit: FitAddon | null = null;
  let sessionId = "";
  let unsubs: Array<() => void> = [];
  let resizeObserver: ResizeObserver | null = null;

  async function startSession() {
    sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    term = new Terminal({
      fontSize: 13,
      fontFamily: '"Cascadia Code", Consolas, monospace',
      cursorBlink: true,
      theme: { background: "#1e1e22" },
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    const id = sessionId;
    term.onData((data) => void backend.write(id, data));
    unsubs.push(
      backend.onData((tid, bytes) => {
        if (tid === id) term?.write(bytes);
      }),
      backend.onExit((tid) => {
        if (tid === id) term?.write("\r\n\x1b[90m[proces skončil — ⟳ spustí nový]\x1b[0m\r\n");
      }),
    );

    try {
      await backend.start(id, shell, ws.explorer.rootPath, term.cols, term.rows);
      term.focus();
    } catch (e) {
      term.write(`\r\n\x1b[31mNelze spustit shell: ${e}\x1b[0m\r\n`);
    }
  }

  function teardown() {
    if (sessionId) void backend.kill(sessionId);
    for (const un of unsubs) un();
    unsubs = [];
    term?.dispose();
    term = null;
    fit = null;
  }

  async function restart() {
    teardown();
    await startSession();
  }

  onMount(() => {
    void startSession();
    resizeObserver = new ResizeObserver(() => {
      if (fit && term) {
        fit.fit();
        void backend.resize(sessionId, term.cols, term.rows);
      }
    });
    resizeObserver.observe(host);
    return () => {
      resizeObserver?.disconnect();
      teardown();
    };
  });
</script>

<div class="terminal">
  <div class="bar">
    <span class="title">Terminál</span>
    <select
      value={shell}
      onchange={(e) => {
        shell = e.currentTarget.value === "cmd" ? "cmd" : "powershell";
        void restart();
      }}
    >
      <option value="powershell">PowerShell</option>
      <option value="cmd">Příkazový řádek (cmd)</option>
    </select>
    <button class="icon" title="Restartovat shell" onclick={() => void restart()}>
      <RotateCcw size={14} />
    </button>
    <span class="grow"></span>
    <button class="icon" title="Zavřít terminál (Ctrl+`)" onclick={onClose}>
      <X size={14} />
    </button>
  </div>
  <div class="host" bind:this={host}></div>
</div>

<style>
  .terminal {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #1e1e22;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
    flex: 0 0 auto;
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }

  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 2px 6px;
    font-family: inherit;
    font-size: 12px;
  }

  .grow {
    flex: 1;
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

  .host {
    flex: 1;
    min-height: 0;
    padding: 4px 6px 0;
  }

  .host :global(.xterm) {
    height: 100%;
  }
</style>
