import { describe, it, expect } from "vitest";
import { classifyFile, LARGE_TEXT_BYTES, type FileInfo } from "./fileInfo";

const info = (over: Partial<FileInfo>): FileInfo => ({
  size: 10,
  binary: false,
  encoding: "UTF-8",
  ...over,
});

describe("classifyFile", () => {
  it("classifies binary files", () => {
    expect(classifyFile(info({ binary: true }))).toBe("binary");
  });

  it("classifies large text files", () => {
    expect(classifyFile(info({ size: LARGE_TEXT_BYTES + 1 }))).toBe("large-text");
  });

  it("classifies normal text files", () => {
    expect(classifyFile(info({ size: 1024 }))).toBe("text");
  });

  it("treats binary as binary even when large", () => {
    expect(classifyFile(info({ binary: true, size: LARGE_TEXT_BYTES * 5 }))).toBe(
      "binary",
    );
  });
});
