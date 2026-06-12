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
    });
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
