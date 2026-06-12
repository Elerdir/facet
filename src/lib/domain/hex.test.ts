import { describe, it, expect } from "vitest";
import { formatHexRows } from "./hex";

describe("formatHexRows", () => {
  it("formats bytes into hex and ascii", () => {
    const rows = formatHexRows(new Uint8Array([0x48, 0x69, 0x00, 0xff]));
    expect(rows).toHaveLength(1);
    expect(rows[0].hex).toBe("48 69 00 ff");
    expect(rows[0].ascii).toBe("Hi..");
  });

  it("splits into rows of the given width with absolute offsets", () => {
    const bytes = new Uint8Array(20).map((_, i) => i);
    const rows = formatHexRows(bytes, 100, 16);
    expect(rows).toHaveLength(2);
    expect(rows[0].offset).toBe(100);
    expect(rows[1].offset).toBe(116);
    expect(rows[1].hex).toBe("10 11 12 13"); // bytes 16..19
  });

  it("renders non-printable bytes as dots in the ascii column", () => {
    const rows = formatHexRows(new Uint8Array([0x09, 0x41, 0x7f]));
    expect(rows[0].ascii).toBe(".A.");
  });
});
