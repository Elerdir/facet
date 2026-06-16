import { describe, it, expect } from "vitest";
import { EDITOR_THEMES, isKnownEditorTheme } from "./editorThemes";

describe("editor themes", () => {
  it("includes the default and several named themes", () => {
    expect(EDITOR_THEMES[0].id).toBe("default");
    expect(EDITOR_THEMES.length).toBeGreaterThan(3);
  });

  it("validates known ids", () => {
    expect(isKnownEditorTheme("default")).toBe(true);
    expect(isKnownEditorTheme("dracula")).toBe(true);
    expect(isKnownEditorTheme("nonsense")).toBe(false);
  });
});
