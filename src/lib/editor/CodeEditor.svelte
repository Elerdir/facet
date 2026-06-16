<script lang="ts">
  import { EditorView, keymap, gutter, GutterMarker } from "@codemirror/view";
  import { EditorState, Compartment } from "@codemirror/state";
  import { basicSetup } from "codemirror";
  import { indentWithTab } from "@codemirror/commands";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { lintGutter } from "@codemirror/lint";
  import { showMinimap } from "@replit/codemirror-minimap";
  import { resolveHighlighting, loadHighlightExtension } from "./highlighting";
  import { completionExtension, lspHoverTooltip, lspLinter } from "./lspExtensions";
  import type { SnippetConfig } from "../domain/snippets";
  import { breakpointExtensions } from "./breakpoints";
  import { signatureHelpExtension, setSignature } from "./signatureHelp";
  import { editorDecorations } from "./decorations";
  import { loadEditorTheme } from "./themes";
  import { ghostCompletion } from "./ghostCompletion";
  import type { SignatureHelp } from "../lsp/signatureHelp";
  import { LARGE_TEXT_BYTES } from "../domain/fileInfo";
  import type { Buffer } from "../domain/buffer";
  import type { BlameLine } from "../domain/vcs";
  import type { ChangeKind } from "../domain/changeGutter";
  import type { LspDiagnostic, LspCompletionItem } from "../application/lsp.svelte";
  import { FORMAT_MARKERS, type TextFormatKind } from "../domain/textFormat";

  // Presentational CodeMirror wrapper: shows `buffer` and reports edits via
  // `onInput`. Highlighting lives in a Compartment so a TextMate grammar can be
  // swapped in asynchronously once its grammar has loaded.
  let {
    buffer,
    onInput,
    theme = "dark",
    editorTheme = "default",
    fontFamily = '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
    fontSize = 13,
    minimap = false,
    formatRequest = null,
    onFormatConsumed,
    revealLine,
    blame,
    changeMarkers,
    lspDiagnostics,
    lspComplete,
    snippets,
    lspHover,
    onGotoDefinition,
    onFindReferences,
    onRenameRequest,
    onCodeAction,
    signatureHelp,
    onInlineEdit,
    ghostComplete,
    breakpointLines,
    debugStopLine = null,
    onToggleBreakpoint,
    onTopLine,
    onCursor,
    onRevealConsumed,
  }: {
    buffer: Buffer | null;
    onInput: (text: string) => void;
    theme?: "dark" | "light";
    editorTheme?: string;
    fontFamily?: string;
    fontSize?: number;
    minimap?: boolean;
    formatRequest?: { kind: TextFormatKind; seq: number } | null;
    onFormatConsumed?: () => void;
    revealLine?: number;
    blame?: BlameLine[] | null;
    changeMarkers?: Map<number, ChangeKind>;
    lspDiagnostics?: LspDiagnostic[];
    lspComplete?: (line: number, character: number) => Promise<LspCompletionItem[]>;
    snippets?: SnippetConfig[];
    lspHover?: (line: number, character: number) => Promise<string | null>;
    onGotoDefinition?: (line: number, character: number) => void;
    onFindReferences?: (line: number, character: number) => void;
    onRenameRequest?: (line: number, character: number) => void;
    onCodeAction?: (line: number, character: number) => void;
    signatureHelp?: (line: number, character: number) => Promise<SignatureHelp | null>;
    onInlineEdit?: (sel: { from: number; to: number; text: string }) => void;
    ghostComplete?: (
      params: { prefix: string; suffix: string; fileName: string },
      signal: AbortSignal,
    ) => Promise<string>;
    breakpointLines?: number[];
    debugStopLine?: number | null;
    onToggleBreakpoint?: (line: number) => void;
    onTopLine?: (line: number) => void;
    onCursor?: (info: {
      line: number;
      col: number;
      selection: number;
      text: string;
      from: number;
      to: number;
    }) => void;
    onRevealConsumed?: () => void;
  } = $props();

  // F12 = go to definition, F2 = rename, Ctrl+click = go to definition.
  function lspNavExtensions() {
    const cursorPos = (v: EditorView) => {
      const head = v.state.selection.main.head;
      const ln = v.state.doc.lineAt(head);
      return { line: ln.number - 1, character: head - ln.from };
    };
    return [
      keymap.of([
        {
          key: "F12",
          run: (v) => {
            if (!onGotoDefinition) return false;
            const p = cursorPos(v);
            onGotoDefinition(p.line, p.character);
            return true;
          },
        },
        {
          key: "Shift-F12",
          run: (v) => {
            if (!onFindReferences) return false;
            const p = cursorPos(v);
            onFindReferences(p.line, p.character);
            return true;
          },
        },
        {
          key: "F2",
          run: (v) => {
            if (!onRenameRequest) return false;
            const p = cursorPos(v);
            onRenameRequest(p.line, p.character);
            return true;
          },
        },
        {
          key: "Mod-.",
          run: (v) => {
            if (!onCodeAction) return false;
            const p = cursorPos(v);
            onCodeAction(p.line, p.character);
            return true;
          },
        },
      ]),
      EditorView.domEventHandlers({
        mousedown: (e, v) => {
          if (!e.ctrlKey || !onGotoDefinition) return false;
          const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos === null) return false;
          const ln = v.state.doc.lineAt(pos);
          onGotoDefinition(ln.number - 1, pos - ln.from);
          return true;
        },
      }),
    ];
  }

  class BlameMarker extends GutterMarker {
    info: BlameLine;
    constructor(info: BlameLine) {
      super();
      this.info = info;
    }
    toDOM(): Node {
      const el = document.createElement("span");
      el.className = "cm-blame";
      el.textContent = this.info.author || this.info.hash;
      el.title = `${this.info.hash} · ${this.info.author}`;
      return el;
    }
  }

  function blameExtension() {
    if (!blame || blame.length === 0) return [];
    const byLine = new Map<number, BlameLine>(blame.map((l) => [l.line, l]));
    return gutter({
      class: "cm-blame-gutter",
      lineMarker(view, block) {
        const lineNo = view.state.doc.lineAt(block.from).number;
        const info = byLine.get(lineNo);
        return info ? new BlameMarker(info) : null;
      },
    });
  }

  class ChangeBarMarker extends GutterMarker {
    kind: ChangeKind;
    constructor(kind: ChangeKind) {
      super();
      this.kind = kind;
    }
    toDOM(): Node {
      const el = document.createElement("div");
      el.className = `cm-change cm-change-${this.kind}`;
      return el;
    }
  }

  function changeExtension() {
    if (!changeMarkers || changeMarkers.size === 0) return [];
    const map = changeMarkers;
    return gutter({
      class: "cm-change-gutter",
      lineMarker(view, block) {
        const lineNo = view.state.doc.lineAt(block.from).number;
        const kind = map.get(lineNo);
        return kind ? new ChangeBarMarker(kind) : null;
      },
    });
  }

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  let currentId: string | null = null;
  let lastEmitted = ""; // last text the editor itself produced (cheap reconcile guard)
  const highlight = new Compartment();
  const themeComp = new Compartment();
  const blameComp = new Compartment();
  const changeComp = new Compartment();
  const lintComp = new Compartment();
  const minimapComp = new Compartment();
  const bpComp = new Compartment();

  function bpExtension() {
    if (!onToggleBreakpoint) return [];
    return breakpointExtensions({
      lines: breakpointLines ?? [],
      stopLine: debugStopLine ?? null,
      onToggle: onToggleBreakpoint,
    });
  }

  function minimapExtension() {
    if (!minimap) return [];
    return showMinimap.compute([], () => ({
      create: () => ({ dom: document.createElement("div") }),
      displayText: "blocks" as const,
      showOverlay: "always" as const,
    }));
  }
  let loadGen = 0; // guards against stale async highlight loads

  // 1-based first visible line at the top edge of the viewport (sticky scroll).
  function emitTopLine(v: EditorView) {
    if (!onTopLine) return;
    const block = v.lineBlockAtHeight(v.scrollDOM.scrollTop + 1);
    onTopLine(v.state.doc.lineAt(block.from).number);
  }

  // Request signature help for the cursor; `clear` hides it (a ")" was typed).
  function requestSignature(v: EditorView, clear: boolean) {
    if (!signatureHelp) return;
    if (clear) {
      v.dispatch({ effects: setSignature.of(null) });
      return;
    }
    const head = v.state.selection.main.head;
    const ln = v.state.doc.lineAt(head);
    void signatureHelp(ln.number - 1, head - ln.from).then((help) => {
      if (!view) return;
      const pos = view.state.selection.main.head;
      view.dispatch({ effects: setSignature.of(help ? { pos, help } : null) });
    });
  }

  function makeState(buf: Buffer): EditorState {
    return EditorState.create({
      doc: buf.content,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        themeComp.of(theme === "dark" ? oneDark : []),
        highlight.of([]),
        editorDecorations,
        blameComp.of(blameExtension()),
        changeComp.of(changeExtension()),
        bpComp.of(bpExtension()),
        minimapComp.of(minimapExtension()),
        ...(lspDiagnostics !== undefined
          ? [lintComp.of(lspLinter(() => lspDiagnostics ?? [])), lintGutter()]
          : []),
        completionExtension({ snippets: snippets ?? [], lspComplete }),
        ...(lspHover ? [lspHoverTooltip(lspHover)] : []),
        ...(onGotoDefinition || onFindReferences || onRenameRequest || onCodeAction
          ? lspNavExtensions()
          : []),
        ...(ghostComplete
          ? [
              ghostCompletion(
                (p, signal) => ghostComplete({ ...p, fileName: buf.name }, signal),
              ),
            ]
          : []),
        ...(signatureHelp ? signatureHelpExtension() : []),
        ...(onInlineEdit
          ? [
              keymap.of([
                {
                  key: "Mod-k",
                  run: (v) => {
                    let { from, to } = v.state.selection.main;
                    if (from === to) {
                      const ln = v.state.doc.lineAt(from);
                      from = ln.from;
                      to = ln.to;
                    }
                    onInlineEdit({ from, to, text: v.state.sliceDoc(from, to) });
                    return true;
                  },
                },
              ]),
            ]
          : []),
        ...(onTopLine
          ? [EditorView.domEventHandlers({ scroll: (_e, v) => void emitTopLine(v) })]
          : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const text = u.state.doc.toString();
            lastEmitted = text;
            onInput(text);
          }
          if (onTopLine && (u.docChanged || u.viewportChanged || u.geometryChanged)) {
            emitTopLine(u.view);
          }
          if (signatureHelp && u.docChanged) {
            let typed = "";
            u.changes.iterChanges((_fa, _ta, _fb, _tb, ins) => {
              typed += ins.toString();
            });
            if (/[(),]/.test(typed)) requestSignature(u.view, typed.includes(")"));
          }
          if ((u.docChanged || u.selectionSet) && onCursor) {
            const sel = u.state.selection.main;
            const ln = u.state.doc.lineAt(sel.head);
            onCursor({
              line: ln.number,
              col: sel.head - ln.from + 1,
              selection: sel.to - sel.from,
              text:
                sel.to > sel.from
                  ? u.state.sliceDoc(sel.from, Math.min(sel.to, sel.from + 24_000))
                  : "",
              from: sel.from,
              to: sel.to,
            });
          }
        }),
      ],
    });
  }

  function applyAsyncHighlight(buf: Buffer) {
    const resolved = resolveHighlighting(buf.name);
    if (resolved.kind === "none") return;
    // Whole-document TextMate tokenization is O(n); skip it on large files
    // (Lezer is incremental, so it stays on regardless of size).
    if (resolved.kind === "textmate" && buf.size > LARGE_TEXT_BYTES) return;
    const gen = ++loadGen;
    void loadHighlightExtension(buf.name).then((ext) => {
      if (ext && view && gen === loadGen && currentId === buf.id) {
        view.dispatch({ effects: highlight.reconfigure(ext) });
      }
    });
  }

  function emptyState(): EditorState {
    return EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        themeComp.of(theme === "dark" ? oneDark : []),
        blameComp.of([]),
        EditorView.editable.of(false),
      ],
    });
  }

  $effect(() => {
    if (!view) view = new EditorView({ parent: host });
    const buf = buffer;
    if (buf) {
      if (buf.id !== currentId) {
        currentId = buf.id;
        lastEmitted = buf.content;
        view.setState(makeState(buf));
        applyAsyncHighlight(buf);
      }
    } else if (currentId !== null) {
      currentId = null;
      loadGen++;
      view.setState(emptyState());
    }
  });

  // Reflect external content changes (e.g. a history restore) into the editor.
  // The lastEmitted guard makes the common typing path a cheap reference check.
  $effect(() => {
    const buf = buffer;
    if (!view || !buf || buf.id !== currentId) return;
    if (buf.content !== lastEmitted) {
      const current = view.state.doc.toString();
      if (buf.content !== current) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: buf.content },
        });
      }
      lastEmitted = buf.content;
    }
  });

  // Live-swap the editor theme when the app theme or chosen theme changes.
  // `thememirror` themes are loaded lazily, so this resolves asynchronously.
  $effect(() => {
    const id = editorTheme;
    const app = theme;
    let cancelled = false;
    void loadEditorTheme(id, app).then((ext) => {
      if (!cancelled && view) view.dispatch({ effects: themeComp.reconfigure(ext) });
    });
    return () => {
      cancelled = true;
    };
  });

  // Toggle the minimap when the setting changes.
  $effect(() => {
    void minimap;
    if (view) {
      view.dispatch({ effects: minimapComp.reconfigure(minimapExtension()) });
    }
  });

  // Toggle the git-blame gutter when blame data changes.
  $effect(() => {
    void blame;
    if (view) {
      view.dispatch({ effects: blameComp.reconfigure(blameExtension()) });
    }
  });

  // Re-render breakpoints / stop-line highlight when the debug state changes.
  $effect(() => {
    void breakpointLines;
    void debugStopLine;
    if (view) {
      view.dispatch({ effects: bpComp.reconfigure(bpExtension()) });
    }
  });

  // Refresh the git change gutter when the diff-vs-HEAD markers change.
  $effect(() => {
    void changeMarkers;
    if (view) {
      view.dispatch({ effects: changeComp.reconfigure(changeExtension()) });
    }
  });

  // Push fresh LSP diagnostics (squiggles) as the server reports them.
  $effect(() => {
    const diags = lspDiagnostics;
    if (view && diags !== undefined) {
      view.dispatch({ effects: lintComp.reconfigure(lspLinter(() => diags)) });
    }
  });

  // Wrap the current selection with markdown-style markers (bold/italic/…).
  $effect(() => {
    const req = formatRequest;
    if (!view || !req) return;
    const [pre, post] = FORMAT_MARKERS[req.kind];
    const sel = view.state.selection.main;
    view.dispatch({
      changes: [
        { from: sel.from, insert: pre },
        { from: sel.to, insert: post },
      ],
      selection: { anchor: sel.from + pre.length, head: sel.to + pre.length },
    });
    view.focus();
    onFormatConsumed?.();
  });

  // Scroll to a requested line (from search / quick-open), then release it.
  $effect(() => {
    const target = revealLine;
    if (view && target != null && target > 0) {
      const lineNo = Math.min(target, view.state.doc.lines);
      const pos = view.state.doc.line(lineNo).from;
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
      onRevealConsumed?.();
    }
  });

  $effect(() => {
    return () => {
      view?.destroy();
      view = null;
    };
  });
</script>

<div
  class="editor-host"
  style={`--editor-font: ${fontFamily}; --editor-font-size: ${fontSize}px`}
  bind:this={host}
></div>

<style>
  .editor-host {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .editor-host :global(.cm-editor) {
    height: 100%;
  }

  .editor-host :global(.cm-scroller) {
    font-family: var(--editor-font, "Cascadia Code", Consolas, monospace);
    font-size: var(--editor-font-size, 13px);
  }

  .editor-host :global(.cm-blame-gutter) {
    background: var(--bg-elev);
    border-right: 1px solid var(--border);
  }

  .editor-host :global(.cm-blame) {
    display: inline-block;
    max-width: 88px;
    padding: 0 6px;
    color: var(--fg-dim);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-host :global(.cm-change-gutter) {
    width: 3px;
    padding: 0;
  }

  .editor-host :global(.cm-change) {
    width: 3px;
    height: 100%;
    min-height: 1.2em;
  }

  .editor-host :global(.cm-change-added) {
    background: #3fb950;
  }

  .editor-host :global(.cm-change-modified) {
    background: #4aa3ff;
  }

  .editor-host :global(.cm-change-removed) {
    background: transparent;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 5px solid #f85149;
    height: 0;
    min-height: 0;
    margin-top: 2px;
  }

  .editor-host :global(.cm-breakpoint-gutter) {
    width: 14px;
    cursor: pointer;
  }

  .editor-host :global(.cm-breakpoint-gutter:hover) {
    background: color-mix(in srgb, #f85149 18%, transparent);
  }

  .editor-host :global(.cm-breakpoint) {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin: 4px 2px 0;
    border-radius: 50%;
    background: #f85149;
  }

  .editor-host :global(.cm-debug-stop) {
    background: color-mix(in srgb, #d29922 22%, transparent);
  }

  .editor-host :global(.cm-signature) {
    padding: 4px 8px;
    font-family: var(--editor-font, "Cascadia Code", Consolas, monospace);
    font-size: 12.5px;
    max-width: 560px;
    white-space: pre-wrap;
  }

  .editor-host :global(.cm-signature b) {
    color: var(--accent);
    font-weight: 600;
  }

  .editor-host :global(.cm-color-swatch) {
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    margin-right: 0.35em;
    vertical-align: baseline;
    border: 1px solid color-mix(in srgb, var(--fg) 35%, transparent);
    border-radius: 3px;
  }

  .editor-host :global(.cm-todo) {
    border-radius: 3px;
    padding: 0 3px;
    font-weight: 700;
  }

  .editor-host :global(.cm-todo-todo),
  .editor-host :global(.cm-todo-note) {
    background: color-mix(in srgb, #4aa3ff 30%, transparent);
    color: #cde6ff;
  }

  .editor-host :global(.cm-todo-fixme),
  .editor-host :global(.cm-todo-bug),
  .editor-host :global(.cm-todo-xxx) {
    background: color-mix(in srgb, #f85149 32%, transparent);
    color: #ffd9d6;
  }

  .editor-host :global(.cm-todo-hack) {
    background: color-mix(in srgb, #d29922 34%, transparent);
    color: #ffe9bd;
  }
</style>
