import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace";
import { Autosave, buffersToAutosave } from "./autosave";
import {
  FakeFileSystem,
  FakeDialog,
  FakeHistory,
  FakeDiff,
  FakeVcs,
  FakeFormatter,
  FakeLspTransport,
  FakeAi,
} from "./testing/fakes";
import type { Buffer } from "../domain/buffer";

function buf(over: Partial<Buffer>): Buffer {
  return {
    id: "x",
    path: null,
    name: "n",
    content: "a",
    savedContent: "a",
    encoding: "UTF-8",
    size: 0,
    binary: false,
    ...over,
  };
}

describe("buffersToAutosave", () => {
  it("selects only dirty buffers that have a path", () => {
    const targets = buffersToAutosave([
      buf({ path: "/clean", content: "x", savedContent: "x" }),
      buf({ path: "/dirty", content: "y", savedContent: "z" }),
      buf({ path: null, content: "q", savedContent: "" }),
    ]);
    expect(targets.map((b) => b.path)).toEqual(["/dirty"]);
  });
});

describe("Autosave.flush", () => {
  it("saves dirty buffers and records a history revision", async () => {
    const fs = new FakeFileSystem();
    const history = new FakeHistory();
    const ws = new Workspace(
      fs,
      new FakeDialog(),
      history,
      new FakeDiff(),
      new FakeVcs(),
      new FakeFormatter(),
      new FakeLspTransport(),
      new FakeAi(),
    );
    fs.files.set("/a.txt", "orig");
    await ws.openPath("/a.txt");
    const id = ws.layout.activeTabId!;
    ws.setContent(id, "edited");

    const auto = new Autosave(ws);
    const saved = await auto.flush();

    expect(saved).toBe(1);
    expect(fs.files.get("/a.txt")).toBe("edited");
    expect(await history.list("/a.txt")).toHaveLength(1);
  });

  it("does nothing when there are no dirty buffers", async () => {
    const fs = new FakeFileSystem();
    const ws = new Workspace(
      fs,
      new FakeDialog(),
      new FakeHistory(),
      new FakeDiff(),
      new FakeVcs(),
      new FakeFormatter(),
      new FakeLspTransport(),
      new FakeAi(),
    );
    fs.files.set("/a.txt", "x");
    await ws.openPath("/a.txt");

    const auto = new Autosave(ws);
    expect(await auto.flush()).toBe(0);
  });
});
