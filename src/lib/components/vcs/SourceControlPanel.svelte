<script lang="ts">
  import {
    RefreshCw,
    Check,
    Plus,
    Minus,
    GitBranch,
    Download,
    ArrowDown,
    ArrowUp,
    Sparkles,
    GitPullRequest,
  } from "@lucide/svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { getWorkspace } from "../../application/context";
  import { statusBadge, type FileStatus, type SyncOp } from "../../domain/vcs";
  import type { PullRequestInfo } from "../../domain/github";

  const ws = getWorkspace();
  let message = $state("");
  let suggesting = $state(false);
  let creatingBranch = $state(false);
  let cloneUrl = $state("");
  let cloning = $state(false);
  let cloneMsg = $state("");
  let cloneErr = $state(false);

  async function doClone() {
    cloning = true;
    cloneErr = false;
    cloneMsg = "";
    try {
      const target = await ws.cloneRepo(cloneUrl.trim());
      cloneMsg = `Naklonováno do ${target}`;
      cloneUrl = "";
    } catch (e) {
      cloneErr = true;
      cloneMsg = e instanceof Error ? e.message : String(e);
    } finally {
      cloning = false;
    }
  }
  let newBranch = $state("");
  let syncMsg = $state("");
  let syncErr = $state(false);

  // Refresh status whenever the open folder (repo root) changes.
  $effect(() => {
    void ws.vcs.refresh(ws.explorer.rootPath);
  });

  async function commit() {
    if (!message.trim()) return;
    await ws.vcs.commit(message);
    message = "";
  }

  async function doCreateBranch() {
    if (!newBranch.trim()) return;
    await ws.vcs.createBranch(newBranch);
    newBranch = "";
    creatingBranch = false;
  }

  async function doSync(op: SyncOp) {
    syncMsg = `${op}…`;
    syncErr = false;
    try {
      const out = await ws.vcs.sync(op);
      syncMsg = out || `${op} hotovo`;
    } catch (e) {
      syncErr = true;
      syncMsg = String(e);
    }
  }

  async function suggestMessage() {
    if (suggesting) return;
    suggesting = true;
    syncErr = false;
    syncMsg = "";
    try {
      message = await ws.suggestCommitMessage();
    } catch (e) {
      syncErr = true;
      syncMsg = e instanceof Error ? e.message : String(e);
    } finally {
      suggesting = false;
    }
  }

  let prs = $state<PullRequestInfo[] | null>(null);
  let prsMsg = $state("");
  let prsLoading = $state(false);

  async function loadPrs() {
    prsLoading = true;
    prsMsg = "";
    try {
      prs = await ws.listPullRequests();
      if (prs.length === 0) prsMsg = "Žádné otevřené pull requesty.";
    } catch (e) {
      prs = null;
      prsMsg = e instanceof Error ? e.message : String(e);
    } finally {
      prsLoading = false;
    }
  }

  function relTime(sec: number): string {
    const diff = Date.now() / 1000 - sec;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return `${Math.floor(diff / 86400)} d`;
  }
</script>

<div class="scm">
  <div class="header">
    <span class="title">Změny</span>
    <button
      class="icon"
      title="Obnovit"
      onclick={() => ws.vcs.refresh(ws.explorer.rootPath)}
    >
      <RefreshCw size={14} />
    </button>
  </div>

  {#if !ws.vcs.status.isRepo}
    {#if ws.explorer.rootPath}
      <div class="empty">Otevřená složka není Git repozitář.</div>
      <div class="setup">
        <button class="setup-btn" onclick={() => void ws.initRepo()}>
          Inicializovat Git repozitář
        </button>
      </div>
    {:else}
      <div class="empty">Otevři složku, nebo naklonuj repozitář.</div>
    {/if}
    <div class="group-title">Klonovat repozitář</div>
    <div class="setup">
      <input
        placeholder="https://github.com/uzivatel/repo.git"
        bind:value={cloneUrl}
      />
      <button
        class="setup-btn"
        disabled={!cloneUrl.trim() || cloning}
        onclick={doClone}
      >
        {cloning ? "Klonuji…" : "Vybrat složku a klonovat"}
      </button>
      {#if cloneMsg}
        <div class="clone-msg" class:err={cloneErr}>{cloneMsg}</div>
      {/if}
    </div>
  {:else}
    <div class="branchbar">
      <GitBranch size={13} />
      <select
        class="branch-select"
        value={ws.vcs.branches.current ?? ""}
        onchange={(e) => ws.vcs.switchBranch(e.currentTarget.value)}
      >
        {#each ws.vcs.branches.all as b (b)}
          <option value={b}>{b}</option>
        {/each}
      </select>
      <button class="mini" title="Nová větev" onclick={() => (creatingBranch = !creatingBranch)}>
        <Plus size={13} />
      </button>
      <span class="grow"></span>
      <button class="mini" title="Fetch" onclick={() => doSync("fetch")}>
        <Download size={13} />
      </button>
      <button class="mini" title="Pull" onclick={() => doSync("pull")}>
        <ArrowDown size={13} />
      </button>
      <button class="mini" title="Push" onclick={() => doSync("push")}>
        <ArrowUp size={13} />
      </button>
    </div>

    {#if creatingBranch}
      <div class="newbranch">
        <input
          placeholder="Název nové větve"
          bind:value={newBranch}
          onkeydown={(e) => e.key === "Enter" && doCreateBranch()}
        />
        <button onclick={doCreateBranch}>Vytvořit</button>
      </div>
    {/if}

    {#if syncMsg}
      <div class="syncmsg" class:err={syncErr}>{syncMsg}</div>
    {/if}

    <div class="commit">
      <div class="msgrow">
        <input
          placeholder="Zpráva commitu"
          bind:value={message}
          onkeydown={(e) => e.key === "Enter" && commit()}
        />
        <button
          class="mini"
          title="Navrhnout zprávu pomocí AI (ze staged změn)"
          disabled={suggesting || ws.vcs.grouped.staged.length === 0}
          onclick={suggestMessage}
        >
          <Sparkles size={14} />
        </button>
      </div>
      <button
        class="commit-btn"
        disabled={!message.trim() || ws.vcs.grouped.staged.length === 0}
        onclick={commit}
      >
        <Check size={14} /> {suggesting ? "Navrhuji…" : "Commit"}
      </button>
    </div>

    {#snippet group(title: string, files: FileStatus[], staged: boolean)}
      <div class="group">
        <div class="group-title">{title} ({files.length})</div>
        {#each files as f (f.path + (staged ? "-s" : "-u"))}
          <div class="row">
            <button class="name" title={f.path} onclick={() => ws.showGitDiff(f.path)}>
              <span class="badge {f.status}">{statusBadge(f.status)}</span>
              <span class="path">{f.path}</span>
            </button>
            {#if staged}
              <button class="act" title="Zrušit přípravu" onclick={() => ws.vcs.unstage(f.path)}>
                <Minus size={13} />
              </button>
            {:else}
              <button class="act" title="Připravit" onclick={() => ws.vcs.stage(f.path)}>
                <Plus size={13} />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/snippet}

    <div class="groups">
      {@render group("Připravené", ws.vcs.grouped.staged, true)}
      {@render group("Změny", ws.vcs.grouped.unstaged, false)}
      {#if ws.vcs.status.files.length === 0}
        <div class="empty">Žádné změny.</div>
      {/if}

      <div class="group-title prs-title">
        Pull requesty (GitHub)
        <button
          class="mini"
          title="Načíst otevřené pull requesty"
          disabled={prsLoading}
          onclick={loadPrs}
        >
          <GitPullRequest size={13} />
        </button>
      </div>
      {#if prsLoading}
        <div class="empty">Načítám…</div>
      {:else if prs}
        {#each prs as pr (pr.number)}
          <button class="prrow" title={pr.url} onclick={() => void openUrl(pr.url)}>
            <span class="prnum">#{pr.number}</span>
            <span class="prtitle">{pr.draft ? "✎ " : ""}{pr.title}</span>
            <span class="prmeta">{pr.author}</span>
          </button>
        {/each}
      {/if}
      {#if prsMsg}
        <div class="empty">{prsMsg}</div>
      {/if}

      {#if ws.vcs.log.length > 0}
        <div class="group-title">Historie</div>
        {#each ws.vcs.log as c (c.hash)}
          <div class="logrow" title={c.message}>
            <span class="hash">{c.hash}</span>
            <span class="msg">{c.message}</span>
            <span class="meta">{c.author} · {relTime(c.time)}</span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .scm {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 6px 0 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }

  .branchbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 6px 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
    color: var(--fg-dim);
  }

  .branch-select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 3px 6px;
    font-family: inherit;
    font-size: 12px;
    max-width: 130px;
  }

  .grow {
    flex: 1;
  }

  .mini {
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

  .mini:hover {
    background: var(--bg-elev-2);
    color: var(--fg);
  }

  .newbranch {
    display: flex;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
  }

  .newbranch input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 5px 8px;
    font-family: inherit;
    font-size: 12px;
  }

  .newbranch button {
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-elev-2);
    color: var(--fg);
    padding: 5px 10px;
    cursor: pointer;
  }

  .syncmsg {
    padding: 6px 10px;
    font-size: 12px;
    color: var(--fg-dim);
    border-bottom: 1px solid var(--border);
    white-space: pre-wrap;
  }

  .syncmsg.err {
    color: var(--danger);
  }

  .logrow {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3px 10px;
    font-size: 12px;
  }

  .logrow .hash {
    flex: 0 0 auto;
    color: var(--accent);
    font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 11px;
  }

  .logrow .msg {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logrow .meta {
    flex: 0 0 auto;
    color: var(--fg-dim);
    font-size: 11px;
  }

  .setup {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 10px 10px;
  }

  .setup input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 6px 8px;
    font-family: inherit;
    font-size: 12px;
  }

  .setup-btn {
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--fg);
    padding: 6px 10px;
    cursor: pointer;
    font-family: inherit;
  }

  .setup-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .clone-msg {
    font-size: 12px;
    color: var(--fg-dim);
    white-space: pre-wrap;
  }

  .clone-msg.err {
    color: var(--danger);
  }

  .prs-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 6px;
  }

  .prrow {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--fg);
    padding: 3px 10px;
    cursor: pointer;
    text-align: left;
    font-size: 12px;
  }

  .prrow:hover {
    background: var(--bg-elev-2);
  }

  .prnum {
    flex: 0 0 auto;
    color: var(--accent);
  }

  .prtitle {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prmeta {
    flex: 0 0 auto;
    color: var(--fg-dim);
    font-size: 11px;
  }

  .icon {
    margin-left: auto;
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

  .empty {
    padding: 12px 10px;
    color: var(--fg-dim);
    font-size: 12px;
  }

  .commit {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .msgrow {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .msgrow input {
    flex: 1;
  }

  .commit input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg);
    padding: 6px 8px;
    font-family: inherit;
    font-size: 12px;
  }

  .commit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-elev-2);
    color: var(--fg);
    padding: 6px;
    cursor: pointer;
  }

  .commit-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .groups {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .group-title {
    padding: 6px 10px 2px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-dim);
  }

  .row {
    display: flex;
    align-items: center;
    padding: 0 6px 0 10px;
    height: 24px;
  }

  .row:hover {
    background: var(--bg-elev-2);
  }

  .name {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--fg);
    cursor: pointer;
    text-align: left;
    font-size: 12.5px;
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    flex: 0 0 auto;
    width: 14px;
    text-align: center;
    font-weight: 700;
    font-size: 11px;
  }

  .badge.modified {
    color: #d29922;
  }
  .badge.added,
  .badge.untracked {
    color: #3fb950;
  }
  .badge.deleted {
    color: #f85149;
  }
  .badge.renamed {
    color: var(--accent);
  }

  .act {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
  }

  .act:hover {
    background: var(--border);
    color: var(--fg);
  }
</style>
