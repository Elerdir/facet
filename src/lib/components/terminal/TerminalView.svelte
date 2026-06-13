<script lang="ts">
  import { onMount } from "svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";
  import { TauriTerminal } from "../../infrastructure/tauriTerminal";
  import { getWorkspace } from "../../application/context";

  // One PTY session bound to one xterm instance; lives as long as its tab.
  let { id, shell, active }: {
    id: string;
    shell: "powershell" | "cmd";
    active: boolean;
  } = $props();

  const ws = getWorkspace();
  const backend = new TauriTerminal();

  let host: HTMLDivElement;
  let term: Terminal | null = null;
  let fit: FitAddon | null = null;
  let unsubs: Array<() => void> = [];

  onMount(() => {
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

    term.onData((data) => void backend.write(id, data));
    unsubs.push(
      backend.onData((tid, bytes) => {
        if (tid === id) term?.write(bytes);
      }),
      backend.onExit((tid) => {
        if (tid === id) term?.write("\r\n\x1b[90m[proces skončil]\x1b[0m\r\n");
      }),
    );

    void backend
      .start(id, shell, ws.explorer.rootPath, term.cols, term.rows)
      .then(() => term?.focus())
      .catch((e) => term?.write(`\r\n\x1b[31mNelze spustit shell: ${e}\x1b[0m\r\n`));

    const observer = new ResizeObserver(() => {
      if (fit && term && active) {
        fit.fit();
        void backend.resize(id, term.cols, term.rows);
      }
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      void backend.kill(id);
      for (const un of unsubs) un();
      unsubs = [];
      term?.dispose();
      term = null;
    };
  });

  // Refit + focus when this tab becomes the visible one.
  $effect(() => {
    if (active && fit && term) {
      fit.fit();
      void backend.resize(id, term.cols, term.rows);
      term.focus();
    }
  });
</script>

<div class="host" bind:this={host}></div>

<style>
  .host {
    height: 100%;
    padding: 4px 6px 0;
  }

  .host :global(.xterm) {
    height: 100%;
  }
</style>
