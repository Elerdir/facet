import { describe, it, expect } from "vitest";
import {
  DEFAULT_AI_MODEL,
  isKnownAiModel,
  modelSupportsAdaptive,
  selectCurrentModels,
  truncateContext,
  buildSystemPrompt,
  buildSelectionPrompt,
  buildCommitPrompt,
  buildInlineEditPrompt,
  stripCodeFences,
  MAX_CONTEXT_CHARS,
} from "./ai";

describe("AI models", () => {
  it("accepts any Claude model id, rejects others", () => {
    expect(isKnownAiModel(DEFAULT_AI_MODEL)).toBe(true);
    expect(isKnownAiModel("claude-fable-5")).toBe(true);
    expect(isKnownAiModel("gpt-4")).toBe(false);
  });

  it("derives adaptive-thinking support from the id pattern", () => {
    expect(modelSupportsAdaptive("claude-opus-4-8")).toBe(true);
    expect(modelSupportsAdaptive("claude-sonnet-4-6")).toBe(true);
    expect(modelSupportsAdaptive("claude-fable-5")).toBe(true);
    expect(modelSupportsAdaptive("claude-haiku-4-5")).toBe(false);
    expect(modelSupportsAdaptive("claude-sonnet-4-5")).toBe(false); // older
    expect(modelSupportsAdaptive("unknown")).toBe(false);
  });

  it("selectCurrentModels keeps the newest of each family and drops legacy", () => {
    const current = selectCurrentModels([
      { id: "claude-opus-4-8", displayName: "Opus 4.8", createdAt: 800 },
      { id: "claude-opus-4-6", displayName: "Opus 4.6", createdAt: 600 },
      { id: "claude-sonnet-4-6", displayName: "Sonnet 4.6", createdAt: 660 },
      { id: "claude-haiku-4-5", displayName: "Haiku 4.5", createdAt: 450 },
      { id: "claude-3-5-haiku-20241022", displayName: "Haiku 3.5 (legacy)", createdAt: 100 },
    ]);
    const ids = current.map((m) => m.id);
    expect(ids).toEqual(["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]);
    expect(ids).not.toContain("claude-opus-4-6");
    expect(ids).not.toContain("claude-3-5-haiku-20241022");
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
    expect(buildSystemPrompt([])).not.toContain("Kontext:");
  });

  it("embeds context files into the system prompt", () => {
    const out = buildSystemPrompt([
      { name: "main.rs", content: "fn main() {}" },
      { name: "lib.rs", content: "pub fn x() {}" },
    ]);
    expect(out).toContain("main.rs");
    expect(out).toContain("fn main() {}");
    expect(out).toContain("lib.rs");
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

  it("builds an inline-edit prompt with instruction and code", () => {
    const out = buildInlineEditPrompt("přidej typ", "let x", "a.ts");
    expect(out).toContain("přidej typ");
    expect(out).toContain("let x");
    expect(out).toContain("a.ts");
  });

  it("strips a wrapping code fence but keeps fence-free text", () => {
    expect(stripCodeFences("```ts\nconst a = 1;\n```")).toBe("const a = 1;");
    expect(stripCodeFences("```\nplain\n```")).toBe("plain");
    expect(stripCodeFences("const a = 1;")).toBe("const a = 1;");
  });
});
