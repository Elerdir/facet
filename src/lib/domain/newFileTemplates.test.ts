import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES, allTemplates } from "./newFileTemplates";
import { wrapText } from "./textFormat";

describe("new-file templates", () => {
  it("ships the requested built-in templates", () => {
    const exts = BUILTIN_TEMPLATES.map((t) => t.extension);
    for (const ext of ["java", "cs", "py", "php", "html", "css", "ts", "rs", "json"]) {
      expect(exts).toContain(ext);
    }
  });

  it("every built-in has non-empty content and unique id", () => {
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(BUILTIN_TEMPLATES.length);
    for (const tpl of BUILTIN_TEMPLATES) expect(tpl.content.length).toBeGreaterThan(0);
  });

  it("appends custom templates after built-ins", () => {
    const all = allTemplates([{ name: "Moje", extension: "foo", content: "x" }]);
    const last = all.at(-1)!;
    expect(last.name).toBe("Moje");
    expect(last.builtin).toBe(false);
    expect(all.length).toBe(BUILTIN_TEMPLATES.length + 1);
  });
});

describe("text format markers", () => {
  it("wraps text per kind", () => {
    expect(wrapText("bold", "ahoj")).toBe("**ahoj**");
    expect(wrapText("italic", "ahoj")).toBe("*ahoj*");
    expect(wrapText("underline", "ahoj")).toBe("<u>ahoj</u>");
    expect(wrapText("strikethrough", "ahoj")).toBe("~~ahoj~~");
    expect(wrapText("code", "ahoj")).toBe("`ahoj`");
  });
});
