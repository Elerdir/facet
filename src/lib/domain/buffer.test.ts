import { describe, it, expect } from "vitest";
import { isDirty, type Buffer } from "./buffer";

function make(content: string, savedContent: string): Buffer {
  return {
    id: "b1",
    path: null,
    name: "x",
    content,
    savedContent,
    encoding: "UTF-8",
    size: 0,
    binary: false,
  };
}

describe("buffer.isDirty", () => {
  it("is false when content matches the saved content", () => {
    expect(isDirty(make("hello", "hello"))).toBe(false);
  });
  it("is true when content diverges from the saved content", () => {
    expect(isDirty(make("hello world", "hello"))).toBe(true);
  });
});
