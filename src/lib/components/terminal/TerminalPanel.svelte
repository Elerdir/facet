<script lang="ts">
  import { onMount } from "svelte";
  import { X, Plus } from "@lucide/svelte";
  import TerminalView from "./TerminalView.svelte";

  let { onClose }: { onClose: () => void } = $props();

  interface Session {
    id: string;
    shell: "powershell" | "cmd";
    label: string;
  }

  let sessions = $state<Session[]>([]);
  let activeId = $state("");
  let newShell = $state<"powershell" | "cmd">("powershell");
  let counter = 1;

  function addSession() {
    const id = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const label = `${newShell === "cmd" ? "cmd" : "PowerShell"} ${counter}`;
    counter += 1;
    sessions.push({ id, shell: newShell, label });
    activeId = id;
  }

  function closeSession(id: string) {
    sessions = sessions.filter((s) => s.id !== id);
    if (activeId === id) activeId = sessions.at(-1)?.id ?? "";
    if (sessions.length === 0) onClose();
  }

  onMount(() => addSession());
</script>

<div class="terminal">
  <div class="bar">
    {#each sessions as s (s.id)}
      <div class="ttab" class:active={s.id === activeId}>
        <button class="ttab-label" onclick={() => (activeId = s.id)}>{s.label}</button>
        <button class="ttab-x" title="Zavřít terminál" onclick={() => closeSession(s.id)}>
          <X size={11} />
        </button>
      </div>
    {/each}
    <select
      value={newShell}
      title="Shell pro nový terminál"
      onchange={(e) => (newShell = e.currentTarget.value === "cmd" ? "cmd" : "powershell")}
    >
      <option value="powershell">PowerShell</option>
      <option value="cmd">cmd</option>
    </select>
    <button class="icon" title="Nový terminál" onclick={addSession}>
      <Plus size={14} />
    </button>
    <span class="grow"></span>
    <button class="icon" title="Zavřít panel (Ctrl+`)" onclick={onClose}>
      <X size={14} />
    </button>
  </div>
  {#each sessions as s (s.id)}
    <div class="view" style:display={s.id === activeId ? "block" : "none"}>
      <TerminalView id={s.id} shell={s.shell} active={s.id === activeId} />
    </div>
  {/each}
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
    gap: 6px;
    height: 30px;
    padding: 0 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
    flex: 0 0 auto;
    overflow-x: auto;
  }

  .ttab {
    display: flex;
    align-items: center;
    gap: 2px;
    border-radius: 5px;
    background: transparent;
    color: var(--fg-dim);
  }

  .ttab.active {
    background: var(--bg);
    color: var(--fg);
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .ttab-label {
    border: none;
    background: transparent;
    color: inherit;
    padding: 4px 2px 4px 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    white-space: nowrap;
  }

  .ttab-x {
    display: inline-flex;
    align-items: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--fg-dim);
    padding: 3px;
    cursor: pointer;
  }

  .ttab-x:hover {
    background: var(--border);
    color: var(--fg);
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
    flex: 0 0 auto;
  }

  .icon:hover {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .view {
    flex: 1;
    min-height: 0;
  }
</style>
