import { describe, it, expect } from "vitest";
import {
  chordFromEvent,
  buildChordMap,
  effectiveChord,
  parseKeybindings,
} from "./keybindings";

const ev = (o: Partial<Parameters<typeof chordFromEvent>[0]>) =>
  ({ ctrlKey: false, shiftKey: false, altKey: false, key: "", code: "", ...o }) as never;

describe("chordFromEvent", () => {
  it("normalizes letters via code (layout-independent)", () => {
    expect(chordFromEvent(ev({ ctrlKey: true, key: "s", code: "KeyS" }))).toBe("Ctrl+S");
    expect(chordFromEvent(ev({ ctrlKey: true, shiftKey: true, key: "P", code: "KeyP" }))).toBe(
      "Ctrl+Shift+P",
    );
  });

  it("handles punctuation and function keys", () => {
    expect(chordFromEvent(ev({ ctrlKey: true, shiftKey: true, key: ">", code: "Period" }))).toBe(
      "Ctrl+Shift+.",
    );
    expect(chordFromEvent(ev({ ctrlKey: true, key: "`", code: "Backquote" }))).toBe("Ctrl+`");
    expect(chordFromEvent(ev({ shiftKey: true, key: "F5", code: "F5" }))).toBe("Shift+F5");
  });

  it("returns null for modifier-only presses", () => {
    expect(chordFromEvent(ev({ ctrlKey: true, key: "Control" }))).toBeNull();
  });
});

describe("keymap resolution", () => {
  it("maps chords to command ids using defaults", () => {
    const map = buildChordMap({});
    expect(map["Ctrl+S"]).toBe("file.save");
    expect(map["Ctrl+Shift+P"]).toBe("view.commandPalette");
  });

  it("applies overrides and unbinds with empty string", () => {
    const map = buildChordMap({ "file.save": "Ctrl+Alt+S", "view.history": "" });
    expect(map["Ctrl+Alt+S"]).toBe("file.save");
    expect(map["Ctrl+S"]).toBeUndefined();
    expect(Object.values(map)).not.toContain("view.history");
  });

  it("effectiveChord respects overrides including unbinding", () => {
    expect(effectiveChord("file.save", {})).toBe("Ctrl+S");
    expect(effectiveChord("file.save", { "file.save": "" })).toBe("");
  });

  it("parseKeybindings keeps only known ids and string chords", () => {
    expect(parseKeybindings({ "file.save": "Ctrl+Alt+S", bogus: "X", "file.open": 5 })).toEqual({
      "file.save": "Ctrl+Alt+S",
    });
  });
});
