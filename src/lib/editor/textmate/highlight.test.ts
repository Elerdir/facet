import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Highlighter, ThemedToken } from "shiki";
import { textmateHighlighter } from "./highlight";

// A fake highlighter so the CodeMirror integration can be verified in jsdom
// without loading the Shiki WASM engine (that is covered by engine.test.ts).
const fakeHighlighter = {
  codeToTokensBase(code: string): ThemedToken[][] {
    const first = code.split(/\s/)[0] ?? "";
    return [[{ content: first, offset: 0, color: "#ff0000", fontStyle: 0 } as ThemedToken]];
  },
} as unknown as Highlighter;

describe("textmateHighlighter (CodeMirror integration)", () => {
  it("produces decorations from tokens inside a real EditorView", () => {
    const plugin = textmateHighlighter(fakeHighlighter, "anything", "github-dark");
    const state = EditorState.create({
      doc: "hello world",
      extensions: [plugin],
    });
    const view = new EditorView({ state, parent: document.body });
    try {
      const instance = view.plugin(plugin);
      expect(instance).not.toBeNull();
      expect(instance!.decorations.size).toBeGreaterThan(0);
    } finally {
      view.destroy();
    }
  });
});
