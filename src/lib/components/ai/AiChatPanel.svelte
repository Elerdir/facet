<script lang="ts">
  import { Trash2, Send, Square, FileStack, AtSign } from "@lucide/svelte";
  import { getWorkspace } from "../../application/context";
  import { relativeTo } from "../../domain/paths";
  import Palette from "../palette/Palette.svelte";
  import type { FileContext } from "../../domain/ai";

  const ws = getWorkspace();
  let input = $state("");
  let scroller: HTMLDivElement | undefined = $state();
  let mentionItems = $state<{ id: string; label: string }[] | null>(null);

  const activeBuffer = $derived.by(() => {
    const id = ws.layout.activeTabId;
    return id ? (ws.buffers.get(id) ?? null) : null;
  });

  async function send() {
    const text = input;
    input = "";
    const contexts: FileContext[] = [];
    const buf = activeBuffer;
    if (ws.ai.includeFileContext && buf && !buf.binary) {
      contexts.push({ name: buf.name, content: buf.content });
    }
    contexts.push(...(await ws.resolveMentions(text)));
    void ws.ai.send(text, contexts);
  }

  async function openMentionPicker() {
    const root = ws.explorer.rootPath;
    const files = await ws.listProjectFiles();
    mentionItems = [
      { id: "codebase", label: "@codebase — prohledat celý projekt (RAG)" },
      ...files.map((p) => {
        const rel = root ? relativeTo(root, p) : p;
        return { id: rel, label: rel };
      }),
    ];
  }

  function insertMention(rel: string) {
    const sep = input === "" || input.endsWith(" ") ? "" : " ";
    input = `${input}${sep}@${rel} `;
    mentionItems = null;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Keep the newest message in view while streaming.
  $effect(() => {
    void ws.ai.messages.at(-1)?.content;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
</script>

<div class="chat">
  <div class="header">
    <span class="title">AI chat</span>
    <button class="icon" title="Přidat soubor do kontextu (@)" onclick={openMentionPicker}>
      <AtSign size={14} />
    </button>
    <button
      class="icon"
      title="Upravit napříč soubory…"
      onclick={() => ws.projectEditUi.show()}
    >
      <FileStack size={14} />
    </button>
    <button class="icon" title="Vyčistit konverzaci" onclick={() => ws.ai.clear()}>
      <Trash2 size={14} />
    </button>
  </div>

  <div class="msgs" bind:this={scroller}>
    {#if ws.ai.messages.length === 0}
      <div class="empty">
        Zeptej se na cokoli — s kontextem aktivního souboru. Další soubory přidáš
        zmínkou <code>@cesta/soubor</code>, celý projekt přes <code>@codebase</code>
        (lokální vyhledávání), nebo tlačítkem @.
        {#if !ws.ai.configured}
          <div class="warn">Nejdřív nastav Claude API klíč v Nastavení (Ctrl+,).</div>
        {/if}
      </div>
    {/if}
    {#each ws.ai.messages as m, i (i)}
      <div class="msg {m.role}">
        <div class="who">{m.role === "user" ? "Ty" : "Claude"}</div>
        <div class="body">{m.content}{#if m.role === "assistant" && i === ws.ai.messages.length - 1 && ws.ai.streaming}▋{/if}</div>
      </div>
    {/each}
    {#if ws.ai.error}
      <div class="error">{ws.ai.error}</div>
    {/if}
  </div>

  <label class="ctx">
    <input type="checkbox" bind:checked={ws.ai.includeFileContext} />
    <span>Připojit aktivní soubor{activeBuffer ? ` (${activeBuffer.name})` : ""}</span>
  </label>

  <div class="inputrow">
    <textarea
      rows="2"
      placeholder="Napiš zprávu… (Enter odešle, @soubor přidá kontext)"
      bind:value={input}
      onkeydown={onKey}
    ></textarea>
    {#if ws.ai.streaming}
      <button class="action stop" title="Zastavit" onclick={() => ws.ai.cancel()}>
        <Square size={15} />
      </button>
    {:else}
      <button class="action" title="Odeslat" disabled={!input.trim()} onclick={send}>
        <Send size={15} />
      </button>
    {/if}
  </div>
</div>

{#if mentionItems}
  <Palette
    placeholder="Přidat soubor do kontextu…"
    items={mentionItems}
    onPick={insertMention}
    onClose={() => (mentionItems = null)}
  />
{/if}

<style>
  .chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 6px 0 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .title {
    flex: 1;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
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

  .msgs {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty {
    color: var(--fg-dim);
    font-size: 12px;
    padding: 6px 4px;
  }

  .warn {
    margin-top: 6px;
    color: var(--danger);
  }

  .msg .who {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-dim);
    margin-bottom: 2px;
  }

  .msg .body {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 9px;
    font-size: 12.5px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
  }

  .msg.user .body {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .error {
    color: var(--danger);
    font-size: 12px;
    white-space: pre-wrap;
  }

  .ctx {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-top: 1px solid var(--border);
    color: var(--fg-dim);
    font-size: 12px;
    flex: 0 0 auto;
  }

  .inputrow {
    display: flex;
    gap: 6px;
    padding: 0 10px 10px;
    flex: 0 0 auto;
  }

  textarea {
    flex: 1;
    resize: none;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    padding: 7px 9px;
    font-family: inherit;
    font-size: 12.5px;
    outline: none;
  }

  textarea:focus {
    border-color: var(--accent);
  }

  .action {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--fg);
    cursor: pointer;
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .action.stop {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 18%, transparent);
  }
</style>
