import { describe, it, expect } from "vitest";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL,
  isKnownAiModel,
  modelSupportsAdaptive,
  truncateContext,
  buildSystemPrompt,
  buildSelectionPrompt,
  buildCommitPrompt,
  MAX_CONTEXT_CHARS,
} from "./ai";

describe("AI models", () => {
  it("has the default model in the catalogue", () => {
    expect(isKnownAiModel(DEFAULT_AI_MODEL)).toBe(true);
    expect(AI_MODELS.length).toBeGreaterThan(0);
  });

  it("knows adaptive-thinking support per model", () => {
    expect(modelSupportsAdaptive("claude-opus-4-8")).toBe(true);
    expect(modelSupportsAdaptive("claude-haiku-4-5")).toBe(false);
    expect(modelSupportsAdaptive("unknown")).toBe(false);
  });
});

describe("prompt builders", () => {
  it("truncates oversized context", () => {
    const long = "x".repeat(MAX_CONTEXT_CHARS + 100);
    const out = truncateContext(long);
    expect(out.length).toBeLessThan(long.length);
    expect(out).toContain("(zkráceno)");
  });

  it("builds a bare system prompt without context", () => {
    expect(buildSystemPrompt(null)).not.toContain("otevřený soubor");
  });

  it("embeds the active file into the system prompt", () => {
    const out = buildSystemPrompt({ name: "main.rs", content: "fn main() {}" });
    expect(out).toContain("main.rs");
    expect(out).toContain("fn main() {}");
  });

  it("builds selection prompts per action", () => {
    expect(buildSelectionPrompt("explain", "let x = 1", "a.ts")).toContain("Vysvětli");
    expect(buildSelectionPrompt("refactor", "let x = 1", "a.ts")).toContain("Refaktoruj");
    expect(buildSelectionPrompt("explain", "let x = 1", "a.ts")).toContain("let x = 1");
  });

  it("builds a commit prompt around the diff", () => {
    const out = buildCommitPrompt("+added line");
    expect(out).toContain("+added line");
    expect(out).toContain("commit");
  });
});
