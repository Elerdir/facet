import { describe, it, expect } from "vitest";
import { renderMarkdown, isPreviewable } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings", async () => {
    const out = await renderMarkdown("# Title");
    expect(out).toContain("<h1>");
    expect(out).toContain("Title");
  });

  it("renders emphasis", async () => {
    expect(await renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("renders lists", async () => {
    const out = await renderMarkdown("- a\n- b");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>a</li>");
  });

  it("escapes raw HTML to prevent injection", async () => {
    const out = await renderMarkdown("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("isPreviewable", () => {
  it("is true for markdown files", () => {
    expect(isPreviewable("README.md")).toBe(true);
    expect(isPreviewable("notes.markdown")).toBe(true);
  });

  it("is false for other file types", () => {
    expect(isPreviewable("main.ts")).toBe(false);
    expect(isPreviewable("Makefile")).toBe(false);
  });
});
