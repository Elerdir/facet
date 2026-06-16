import { describe, it, expect } from "vitest";
import { serverForName, userServerForName, parseLspServers } from "./servers";

describe("serverForName", () => {
  it("maps TypeScript family files to one shared server with the right languageId", () => {
    expect(serverForName("a.ts")).toMatchObject({
      serverId: "typescript",
      command: "typescript-language-server",
      languageId: "typescript",
    });
    expect(serverForName("a.tsx")?.languageId).toBe("typescriptreact");
    expect(serverForName("a.jsx")?.languageId).toBe("javascriptreact");
    // ts and js share the same server process key
    expect(serverForName("a.ts")?.serverId).toBe(serverForName("a.js")?.serverId);
  });

  it("maps other languages to their servers", () => {
    expect(serverForName("main.rs")?.command).toBe("rust-analyzer");
    expect(serverForName("app.py")?.languageId).toBe("python");
    expect(serverForName("main.cpp")?.command).toBe("clangd");
    expect(serverForName("style.scss")?.languageId).toBe("scss");
    expect(serverForName("conf.yaml")?.serverId).toBe("yaml");
  });

  it("returns null for files without a configured server", () => {
    expect(serverForName("notes.md")).toBeNull();
    expect(serverForName("data.unknown")).toBeNull();
  });
});

describe("user-configured servers", () => {
  const configs = parseLspServers([
    { extensions: [".zig", "zig"], command: "zls", args: [], languageId: "zig" },
    { extensions: ["ts"], serverId: "myts", command: "my-ts-server", args: ["--stdio"], languageId: "typescript" },
    { command: "bad" }, // dropped: no extensions
  ]);

  it("validates and normalizes raw config", () => {
    expect(configs).toHaveLength(2);
    expect(configs[0]).toMatchObject({ serverId: "zls", command: "zls", languageId: "zig" });
  });

  it("resolves a user server and overrides built-ins", () => {
    expect(userServerForName("main.zig", configs)?.command).toBe("zls");
    expect(userServerForName("a.ts", configs)?.command).toBe("my-ts-server");
    expect(userServerForName("a.py", configs)).toBeNull();
  });
});
