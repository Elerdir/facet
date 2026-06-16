import { describe, it, expect } from "vitest";
import { parseSettings, DEFAULT_SETTINGS } from "./settings";

describe("parseSettings", () => {
  it("reads valid settings", () => {
    const s = parseSettings(
      JSON.stringify({
        autosaveEnabled: false,
        autosaveSeconds: 60,
        historyRetentionDays: 14,
        theme: "light",
        lspEnabled: false,
        aiApiKey: "sk-ant-test",
        aiModel: "claude-haiku-4-5",
        aiGhostCompletion: true,
        editorFontFamily: "Fira Code",
        editorFontSize: 16,
        editorMinimap: false,
        editorBreadcrumbs: false,
        editorStickyScroll: false,
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
      lspEnabled: false,
      aiApiKey: "sk-ant-test",
      aiModel: "claude-haiku-4-5",
      aiGhostCompletion: true,
      editorFontFamily: "Fira Code",
      editorFontSize: 16,
      editorMinimap: false,
      editorBreadcrumbs: false,
      editorStickyScroll: false,
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
});
