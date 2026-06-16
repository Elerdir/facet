<script lang="ts">
  import TabBar from "../TabBar.svelte";
  import CodeEditor from "../../editor/CodeEditor.svelte";
  import MarkdownPreview from "../preview/MarkdownPreview.svelte";
  import HexView from "../hex/HexView.svelte";
  import Breadcrumbs from "../breadcrumbs/Breadcrumbs.svelte";
  import { getWorkspace } from "../../application/context";
  import { serverForName } from "../../lsp/servers";
  import type { PaneLeaf } from "../../domain/layout";

  let { leaf }: { leaf: PaneLeaf } = $props();
  const ws = getWorkspace();

  const buffer = $derived(
    leaf.activeTab ? (ws.buffers.get(leaf.activeTab) ?? null) : null,
  );
  const isActivePane = $derived(ws.layout.activeLeafId === leaf.id);
  const revealLine = $derived(
    ws.layout.revealTarget && buffer && ws.layout.revealTarget.bufferId === buffer.id
      ? ws.layout.revealTarget.line
      : undefined,
  );
  const blame = $derived(
    ws.vcs.blame && buffer?.path === ws.vcs.blame.path ? ws.vcs.blame.lines : null,
  );
  const lspActive = $derived(
    !!buffer?.path &&
      ws.settings.current.lspEnabled &&
      serverForName(buffer.name) !== null,
  );
  const lspDiagnostics = $derived(
    lspActive && buffer?.path ? ws.lspDiagnostics(buffer.path) : undefined,
  );
  const breakpointLines = $derived(
    buffer?.path ? ws.breakpoints.linesFor(buffer.path) : [],
  );
  const debugStopLine = $derived(
    buffer?.path && ws.debug.currentLocation?.path === buffer.path
      ? ws.debug.currentLocation.line
      : null,
  );
</script>

<div
  class="pane"
  class:active={isActivePane}
  role="group"
  onfocusin={() => ws.layout.setActiveLeaf(leaf.id)}
>
  <TabBar {leaf} />
  <div class="pane-body">
    {#if leaf.tabs.length === 0}
      <div class="empty">Prázdný panel</div>
    {:else if leaf.view === "hex"}
      {#key buffer?.id}
        <HexView {buffer} />
      {/key}
    {:else if leaf.view === "preview"}
      <MarkdownPreview {buffer} />
    {:else}
      <div class="editor-stack">
        {#if ws.settings.current.editorBreadcrumbs && buffer}
          <Breadcrumbs {buffer} active={isActivePane} />
        {/if}
        <div class="editor-fill">
          <CodeEditor
        {buffer}
        theme={ws.settings.current.theme}
        fontFamily={ws.settings.current.editorFontFamily}
        fontSize={ws.settings.current.editorFontSize}
        minimap={ws.settings.current.editorMinimap}
        formatRequest={isActivePane ? ws.textFormat.request : null}
        onFormatConsumed={() => ws.textFormat.consume()}
        {revealLine}
        {blame}
        {lspDiagnostics}
        lspComplete={lspActive
          ? (line, ch) =>
              buffer?.path ? ws.lspComplete(buffer.path, line, ch) : Promise.resolve([])
          : undefined}
        lspHover={lspActive
          ? (line, ch) =>
              buffer?.path ? ws.lspHover(buffer.path, line, ch) : Promise.resolve(null)
          : undefined}
        onGotoDefinition={lspActive
          ? (line, ch) => {
              if (buffer?.path) void ws.lspGotoDefinition(buffer.path, line, ch);
            }
          : undefined}
        onFindReferences={lspActive
          ? (line, ch) => {
              if (buffer?.path) void ws.lspFindReferences(buffer.path, line, ch);
            }
          : undefined}
        onRenameRequest={lspActive
          ? (line, ch) => {
              if (buffer?.path) ws.renameUi.open({ path: buffer.path, line, character: ch });
            }
          : undefined}
        ghostComplete={ws.settings.current.aiGhostCompletion &&
        ws.settings.current.aiApiKey.trim() !== ""
          ? (params, signal) =>
              ws.ai.ghostComplete(params.prefix, params.suffix, params.fileName, signal)
          : undefined}
        onInlineEdit={(sel) => {
          if (buffer && !buffer.binary) {
            ws.startInlineEdit({
              bufferId: buffer.id,
              from: sel.from,
              to: sel.to,
              original: sel.text,
              fileName: buffer.name,
            });
          }
        }}
        {breakpointLines}
        {debugStopLine}
        onToggleBreakpoint={(line) => {
          if (buffer?.path) ws.toggleBreakpoint(buffer.path, line);
        }}
        onInput={(text) => {
          if (buffer) ws.setContent(buffer.id, text);
        }}
        onCursor={(info) => {
          if (ws.layout.activeLeafId === leaf.id) {
            ws.editorStatus.set(
              info.line,
              info.col,
              info.selection,
              info.text,
              info.from,
              info.to,
            );
          }
        }}
            onRevealConsumed={() => ws.layout.consumeReveal()}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .pane {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pane.active {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .pane-body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .editor-stack {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .editor-fill {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-dim);
  }
</style>
