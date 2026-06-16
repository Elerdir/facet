import { describe, it, expect } from "vitest";
import {
  detectEol,
  convertEol,
  detectIndent,
  tabsToSpaces,
  spacesToTabs,
} from "./textInfo";

describe("EOL", () => {
  it("detects LF and CRLF", () => {
    expect(detectEol("a\nb")).toBe("lf");
    expect(detectEol("a\r\nb")).toBe("crlf");
  });

  it("converts between LF and CRLF idempotently", () => {
    expect(convertEol("a\r\nb\n", "lf")).toBe("a\nb\n");
    expect(convertEol("a\nb\n", "crlf")).toBe("a\r\nb\r\n");
    expect(convertEol("a\r\nb", "crlf")).toBe("a\r\nb");
  });
});

describe("indentation", () => {
  it("detects spaces with the unit size", () => {
    expect(detectIndent("foo\n  bar\n    baz")).toEqual({ kind: "spaces", size: 2 });
  });

  it("detects tabs", () => {
    expect(detectIndent("foo\n\tbar\n\t\tbaz")).toEqual({ kind: "tabs", size: 4 });
  });

  it("converts tabs to spaces and back", () => {
    expect(tabsToSpaces("\tx\n\t\ty", 2)).toBe("  x\n    y");
    expect(spacesToTabs("  x\n    y", 2)).toBe("\tx\n\t\ty");
  });

  it("keeps remainder spaces when converting to tabs", () => {
    expect(spacesToTabs("     x", 4)).toBe("\t x"); // 4 -> tab, 1 left
  });
});
