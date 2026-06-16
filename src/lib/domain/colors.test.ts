import { describe, it, expect } from "vitest";
import { findColors } from "./colors";

describe("findColors", () => {
  it("finds hex colors of valid lengths", () => {
    const cols = findColors("a: #fff; b: #ff8800; c: #11223344;");
    expect(cols.map((c) => c.color)).toEqual(["#fff", "#ff8800", "#11223344"]);
  });

  it("does not match invalid-length hex runs", () => {
    expect(findColors("#12345")).toEqual([]);
    expect(findColors("#1234567")).toEqual([]);
  });

  it("finds rgb/rgba/hsl forms", () => {
    const cols = findColors("rgb(255, 0, 0) rgba(0,0,0,.5) hsl(120 50% 50%)");
    expect(cols.map((c) => c.color)).toEqual([
      "rgb(255, 0, 0)",
      "rgba(0,0,0,.5)",
      "hsl(120 50% 50%)",
    ]);
  });

  it("reports correct offsets", () => {
    const [c] = findColors("x = #abc");
    expect(c).toEqual({ from: 4, to: 8, color: "#abc" });
  });
});
