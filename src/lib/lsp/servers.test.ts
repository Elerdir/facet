import { describe, it, expect } from "vitest";
import { serverForName } from "./servers";

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
  });

  it("returns null for files without a configured server", () => {
    expect(serverForName("notes.md")).toBeNull();
    expect(serverForName("data.unknown")).toBeNull();
  });
});
