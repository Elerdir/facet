import { describe, it, expect } from "vitest";
import { adapterForFile, launchConfig } from "./adapters";

describe("debug adapters", () => {
  it("maps Python files to debugpy", () => {
    const spec = adapterForFile("app.py");
    expect(spec).toMatchObject({ adapterId: "debugpy", command: "python", type: "python" });
  });

  it("maps Go and native files to their adapters", () => {
    expect(adapterForFile("main.go")?.command).toBe("dlv");
    expect(adapterForFile("lib.rs")?.adapterId).toBe("lldb");
    expect(adapterForFile("main.cpp")?.adapterId).toBe("lldb");
  });

  it("returns null for unconfigured types", () => {
    expect(adapterForFile("notes.txt")).toBeNull();
    expect(adapterForFile("README.md")).toBeNull();
  });

  it("builds a launch config with program and cwd", () => {
    const spec = adapterForFile("app.py")!;
    const cfg = launchConfig(spec, "/proj/app.py", "/proj", true);
    expect(cfg).toMatchObject({
      request: "launch",
      type: "python",
      program: "/proj/app.py",
      cwd: "/proj",
      stopOnEntry: true,
    });
  });
});
