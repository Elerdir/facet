import { describe, it, expect } from "vitest";
import {
  normalize,
  basename,
  dirname,
  extension,
  relativeTo,
  fileUri,
  pathFromFileUri,
} from "./paths";

describe("paths.normalize", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalize("E:\\Projects\\facet")).toBe("E:/Projects/facet");
  });
  it("leaves forward slashes untouched", () => {
    expect(normalize("/usr/local/bin")).toBe("/usr/local/bin");
  });
});

describe("paths.basename", () => {
  it("returns the last segment for windows paths", () => {
    expect(basename("E:\\Projects\\facet\\App.svelte")).toBe("App.svelte");
  });
  it("returns the last segment for posix paths", () => {
    expect(basename("/home/user/file.txt")).toBe("file.txt");
  });
  it("ignores a trailing slash", () => {
    expect(basename("/home/user/dir/")).toBe("dir");
  });
  it("returns the input when there is no separator", () => {
    expect(basename("file.txt")).toBe("file.txt");
  });
});

describe("paths.dirname", () => {
  it("returns the parent directory", () => {
    expect(dirname("E:\\Projects\\facet\\App.svelte")).toBe("E:/Projects/facet");
  });
  it("returns root for top-level posix files", () => {
    expect(dirname("/file.txt")).toBe("/");
  });
  it("returns empty when there is no parent", () => {
    expect(dirname("file.txt")).toBe("");
  });
});

describe("paths.extension", () => {
  it("extracts a simple extension, lower-cased", () => {
    expect(extension("Component.SVELTE")).toBe("svelte");
  });
  it("uses the last extension for multi-dot names", () => {
    expect(extension("archive.tar.gz")).toBe("gz");
  });
  it("treats dotfiles as having no extension", () => {
    expect(extension(".gitignore")).toBe("");
  });
  it("returns empty for names without a dot", () => {
    expect(extension("Makefile")).toBe("");
  });
  it("works on full paths", () => {
    expect(extension("E:\\Projects\\main.rs")).toBe("rs");
  });
});

describe("paths.relativeTo", () => {
  it("strips the root prefix", () => {
    expect(relativeTo("E:/proj", "E:/proj/src/App.svelte")).toBe("src/App.svelte");
  });
  it("normalizes separators", () => {
    expect(relativeTo("E:\\proj", "E:\\proj\\a.ts")).toBe("a.ts");
  });
  it("returns the original path when not under root", () => {
    expect(relativeTo("/root", "/other/x.ts")).toBe("/other/x.ts");
  });
});

describe("paths.fileUri", () => {
  it("builds a file URI from a Windows path", () => {
    expect(fileUri("E:\\Projects\\a.ts")).toBe("file:///E:/Projects/a.ts");
  });
  it("builds a file URI from a POSIX path", () => {
    expect(fileUri("/home/u/a.ts")).toBe("file:///home/u/a.ts");
  });
});

describe("paths.pathFromFileUri", () => {
  it("converts a Windows file URI back to a path", () => {
    expect(pathFromFileUri("file:///E:/Projects/a.ts")).toBe("E:/Projects/a.ts");
  });
  it("converts a POSIX file URI back to a path", () => {
    expect(pathFromFileUri("file:///home/u/a.ts")).toBe("/home/u/a.ts");
  });
  it("round-trips with fileUri", () => {
    expect(pathFromFileUri(fileUri("E:/p/x.ts"))).toBe("E:/p/x.ts");
  });
});
