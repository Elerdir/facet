import { describe, it, expect } from "vitest";
import { resolveLanguageId } from "./fileTypes";

describe("resolveLanguageId", () => {
  it("resolves built-in extensions to TextMate language ids", () => {
    expect(resolveLanguageId("config.toml")).toBe("toml");
    expect(resolveLanguageId("main.go")).toBe("go");
    expect(resolveLanguageId("deploy.yaml")).toBe("yaml");
  });

  it("matches whole filenames without an extension", () => {
    expect(resolveLanguageId("Dockerfile")).toBe("docker");
    expect(resolveLanguageId("Makefile")).toBe("make");
    expect(resolveLanguageId("E:/proj/Dockerfile")).toBe("docker");
  });

  it("lets user rules override built-ins", () => {
    const rules = [{ extensions: ["toml"], language: "ini" }];
    expect(resolveLanguageId("config.toml", rules)).toBe("ini");
  });

  it("resolves custom user extensions", () => {
    const rules = [{ extensions: ["foo"], language: "toml" }];
    expect(resolveLanguageId("thing.foo", rules)).toBe("toml");
  });

  it("returns null for unknown or extensionless names", () => {
    expect(resolveLanguageId("data.unknownext")).toBeNull();
    expect(resolveLanguageId("LICENSE")).toBeNull();
  });
});
