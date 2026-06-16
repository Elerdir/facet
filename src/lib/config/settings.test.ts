import { describe, it, expect } from "vitest";
import { parseSettings, parseProjectSettings, DEFAULT_SETTINGS } from "./settings";

describe("parseProjectSettings", () => {
  it("keeps only present overridable keys (no secrets), validated", () => {
    const o = parseProjectSettings(
      JSON.stringify({ editorTheme: "dracula", editorFontSize: 99, aiApiKey: "x", bogus: 1 }),
    );
    expect(o).toEqual({ editorTheme: "dracula", editorFontSize: 32 });
  });

  it("returns {} for invalid JSON or non-objects", () => {
    expect(parseProjectSettings("{bad")).toEqual({});
    expect(parseProjectSettings("42")).toEqual({});
  });
});

describe("parseSettings", () => {
  it("reads valid settings", () => {
    const s = parseSettings(
      JSON.stringify({
        autosaveEnabled: false,
        autosaveSeconds: 60,
        historyRetentionDays: 14,
        theme: "light",
        editorTheme: "dracula",
        lspEnabled: false,
        lspServers: [
          { extensions: ["zig"], command: "zls", args: [], languageId: "zig" },
        ],
        keybindings: { "file.save": "Ctrl+Alt+S" },
        snippets: [{ prefix: "p", body: "x", extensions: ["ts"] }],
        aiApiKey: "sk-ant-test",
        aiModel: "claude-haiku-4-5",
        aiGhostCompletion: true,
        editorFontFamily: "Fira Code",
        editorFontSize: 16,
        editorMinimap: false,
        editorBreadcrumbs: false,
        editorStickyScroll: false,
        editorRenderWhitespace: true,
        editorInlayHints: false,
        editorDocHighlight: false,
        formatOnSave: true,
        fileTemplates: [{ name: "Moje", extension: ".FOO", content: "x" }],
        githubToken: "ghp_1",
        gitlabToken: "glpat_2",
        gitlabHost: "git.firma.cz",
      }),
    );
    expect(s).toEqual({
      autosaveEnabled: false,
      autosaveSeconds: 60,
      historyRetentionDays: 14,
      theme: "light",
      editorTheme: "dracula",
      lspEnabled: false,
      lspServers: [
        { extensions: ["zig"], serverId: "zls", command: "zls", args: [], languageId: "zig" },
      ],
      keybindings: { "file.save": "Ctrl+Alt+S" },
      snippets: [{ prefix: "p", body: "x", description: undefined, extensions: ["ts"] }],
      aiApiKey: "sk-ant-test",
      aiModel: "claude-haiku-4-5",
      aiGhostCompletion: true,
      editorFontFamily: "Fira Code",
      editorFontSize: 16,
      editorMinimap: false,
      editorBreadcrumbs: false,
      editorStickyScroll: false,
      editorRenderWhitespace: true,
      editorInlayHints: false,
      editorDocHighlight: false,
      formatOnSave: true,
      fileTemplates: [{ name: "Moje", extension: "foo", content: "x" }],
      githubToken: "ghp_1",
      gitlabToken: "glpat_2",
      gitlabHost: "git.firma.cz",
    });
  });

  it("clamps the editor font size and drops malformed templates", () => {
    const s = parseSettings(
      JSON.stringify({
        editorFontSize: 99,
        fileTemplates: [{ name: "ok", extension: "a", content: "x" }, { name: 5 }, "bad"],
      }),
    );
    expect(s.editorFontSize).toBe(32);
    expect(s.fileTemplates).toEqual([{ name: "ok", extension: "a", content: "x" }]);
  });

  it("falls back to the default AI model for unknown ids", () => {
    expect(parseSettings(JSON.stringify({ aiModel: "gpt-9000" })).aiModel).toBe(
      "claude-opus-4-8",
    );
  });

  it("clamps out-of-range numbers", () => {
    const s = parseSettings(
      JSON.stringify({ autosaveSeconds: 1, historyRetentionDays: 9999 }),
    );
    expect(s.autosaveSeconds).toBe(5);
    expect(s.historyRetentionDays).toBe(365);
  });

  it("falls back to defaults for invalid JSON", () => {
    expect(parseSettings("{ broken")).toEqual(DEFAULT_SETTINGS);
  });

  it("ignores unknown theme values", () => {
    expect(parseSettings(JSON.stringify({ theme: "neon" })).theme).toBe("dark");
  });

  it("falls back to the default editor theme for unknown ids", () => {
    expect(parseSettings(JSON.stringify({ editorTheme: "made-up" })).editorTheme).toBe("default");
  });
});
