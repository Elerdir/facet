import { describe, it, expect } from "vitest";
import {
  BUILTIN_TEMPLATES,
  allTemplates,
  templateLanguages,
} from "./newFileTemplates";
import { wrapText } from "./textFormat";

describe("new-file templates", () => {
  it("covers the requested languages", () => {
    const exts = BUILTIN_TEMPLATES.map((t) => t.extension);
    for (const ext of ["java", "cs", "py", "php", "html", "css", "ts", "rs", "json"]) {
      expect(exts).toContain(ext);
    }
  });

  it("offers multiple variants per language (e.g. Java class/record/enum)", () => {
    const java = BUILTIN_TEMPLATES.filter((t) => t.language === "Java").map((t) => t.name);
    expect(java).toEqual(expect.arrayContaining(["Třída", "Rozhraní", "Record", "Enum"]));
    const rust = BUILTIN_TEMPLATES.filter((t) => t.language === "Rust");
    expect(rust.length).toBeGreaterThanOrEqual(3);
  });

  it("every built-in has non-empty content and unique id", () => {
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(BUILTIN_TEMPLATES.length);
    for (const tpl of BUILTIN_TEMPLATES) expect(tpl.content.length).toBeGreaterThan(0);
  });

  it("appends custom templates under the 'Vlastní' language by default", () => {
    const all = allTemplates([{ name: "Moje", extension: "foo", content: "x" }]);
    const last = all.at(-1)!;
    expect(last.language).toBe("Vlastní");
    expect(last.builtin).toBe(false);
    expect(templateLanguages(all)).toContain("Vlastní");
  });

  it("custom templates can declare their own section (existing or new)", () => {
    const all = allTemplates([
      { name: "Servlet", extension: "java", content: "x", language: "Java" },
      { name: "Playbook", extension: "yml", content: "y", language: "Ansible" },
    ]);
    expect(all.find((t) => t.name === "Servlet")!.language).toBe("Java");
    expect(templateLanguages(all)).toContain("Ansible");
  });

  it("lists languages uniquely in display order", () => {
    const langs = templateLanguages(BUILTIN_TEMPLATES);
    expect(langs[0]).toBe("Java");
    expect(new Set(langs).size).toBe(langs.length);
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
