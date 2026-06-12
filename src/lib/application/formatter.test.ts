import { describe, it, expect } from "vitest";
import { FormatterService } from "./formatter";
import { FakeFormatter } from "./testing/fakes";
import type { Buffer } from "../domain/buffer";

function buf(name: string, content: string): Buffer {
  return {
    id: "x",
    path: null,
    name,
    content,
    savedContent: content,
    encoding: "UTF-8",
    size: 0,
    binary: false,
  };
}

describe("FormatterService", () => {
  it("formats web languages in-process with Prettier", async () => {
    const svc = new FormatterService(new FakeFormatter());
    const out = await svc.format(buf("a.ts", "const  x=1"), "format");
    expect(out).toBe("const x = 1;\n");
  });

  it("returns null when the content is already formatted", async () => {
    const svc = new FormatterService(new FakeFormatter());
    expect(await svc.format(buf("a.ts", "const x = 1;\n"), "format")).toBeNull();
  });

  it("delegates to the external runner for non-web languages", async () => {
    const fake = new FakeFormatter();
    fake.result = "formatted!";
    const svc = new FormatterService(fake);
    const out = await svc.format(buf("main.rs", "fn main(){}"), "format");
    expect(out).toBe("formatted!");
    expect(fake.calls[0].program).toBe("rustfmt");
  });

  it("returns null when no formatter applies", async () => {
    const svc = new FormatterService(new FakeFormatter());
    expect(await svc.format(buf("a.xyz", "x"), "format")).toBeNull();
  });

  it("reports availability via canFormat", () => {
    const svc = new FormatterService(new FakeFormatter());
    expect(svc.canFormat("a.ts", "format")).toBe(true);
    expect(svc.canFormat("a.py", "organizeImports")).toBe(true);
    expect(svc.canFormat("a.xyz", "format")).toBe(false);
  });
});
