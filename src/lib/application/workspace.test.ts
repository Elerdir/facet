import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace";
import {
  FakeFileSystem,
  FakeDialog,
  FakeHistory,
  FakeDiff,
  FakeVcs,
  FakeFormatter,
  FakeLspTransport,
  FakeWatcher,
  FakeAi,
  FakeGithub,
} from "./testing/fakes";

function setup() {
  const fs = new FakeFileSystem();
  const dialog = new FakeDialog();
  const history = new FakeHistory();
  const watcher = new FakeWatcher();
  const vcs = new FakeVcs();
  const ai = new FakeAi();
  const github = new FakeGithub();
  const ws = new Workspace(
    fs,
    dialog,
    history,
    new FakeDiff(),
    vcs,
    new FakeFormatter(),
    new FakeLspTransport(),
    ai,
    watcher,
    null,
    github,
  );
  return { fs, dialog, history, watcher, vcs, ai, github, ws };
}

describe("Workspace open flow", () => {
  it("opens a text file in the active editor pane", async () => {
    const { fs, ws } = setup();
    fs.files.set("/a.ts", "const x = 1");
    await ws.openPath("/a.ts");

    const id = ws.layout.activeTabId;
    expect(id).not.toBeNull();
    const buf = ws.buffers.get(id!)!;
    expect(buf.content).toBe("const x = 1");
    expect(buf.binary).toBe(false);
    expect(ws.layout.activeLeaf.view).toBe("editor");
  });

  it("opens a binary file in a hex pane without reading text", async () => {
    const { fs, ws } = setup();
    fs.infos.set("/img.png", { size: 2048, binary: true, encoding: "binary" });
    await ws.openPath("/img.png");

    const buf = ws.buffers.get(ws.layout.activeTabId!)!;
    expect(buf.binary).toBe(true);
    expect(buf.content).toBe("");
    expect(buf.size).toBe(2048);
    expect(ws.layout.activeLeaf.view).toBe("hex");
  });

  it("reverts a pane out of hex mode when a text file is opened in it", async () => {
    const { fs, ws } = setup();
    fs.infos.set("/img.png", { size: 16, binary: true, encoding: "binary" });
    fs.files.set("/notes.md", "# hi");
    await ws.openPath("/img.png");
    expect(ws.layout.activeLeaf.view).toBe("hex");

    await ws.openPath("/notes.md");
    expect(ws.layout.activeLeaf.view).toBe("editor");
  });

  it("reads byte windows through the file system port", async () => {
    const { fs, ws } = setup();
    fs.chunks.set("/d.bin", new Uint8Array([0, 1, 2, 3, 4, 5]));
    const bytes = await ws.readChunk("/d.bin", 2, 3);
    expect(Array.from(bytes)).toEqual([2, 3, 4]);
  });

  it("dedupes reopening the same file", async () => {
    const { fs, ws } = setup();
    fs.files.set("/a.ts", "x");
    await ws.openPath("/a.ts");
    await ws.openPath("/a.ts");
    expect(ws.buffers.items).toHaveLength(1);
  });

  it("records a history revision on save and restores it", async () => {
    const { fs, ws, history } = setup();
    fs.files.set("/a.txt", "v1");
    await ws.openPath("/a.txt");
    const id = ws.layout.activeTabId!;

    ws.setContent(id, "v2");
    await ws.saveBuffer(id);
    expect(fs.files.get("/a.txt")).toBe("v2");

    const revisions = await history.list("/a.txt");
    expect(revisions).toHaveLength(1);

    ws.setContent(id, "scratch");
    await ws.restoreRevision(id, revisions[0].id);
    expect(ws.buffers.get(id)!.content).toBe("v2");
  });

  it("closes a clean tab without confirming", async () => {
    const { fs, ws } = setup();
    fs.files.set("/a.ts", "x");
    await ws.openPath("/a.ts");
    const leaf = ws.layout.activeLeaf;
    const tab = leaf.activeTab!;
    await ws.closeTab(leaf.id, tab);
    expect(ws.layout.activeLeaf.tabs).not.toContain(tab);
  });

  it("confirms before discarding unsaved changes on close", async () => {
    const { fs, dialog, ws } = setup();
    fs.files.set("/a.ts", "x");
    await ws.openPath("/a.ts");
    const leaf = ws.layout.activeLeaf;
    const tab = leaf.activeTab!;
    ws.setContent(tab, "edited");

    dialog.confirmResult = false; // user cancels
    await ws.closeTab(leaf.id, tab);
    expect(ws.layout.activeLeaf.tabs).toContain(tab); // kept open

    dialog.confirmResult = true; // user confirms
    await ws.closeTab(leaf.id, tab);
    expect(ws.layout.activeLeaf.tabs).not.toContain(tab); // closed
  });

  it("searches the open project folder", async () => {
    const { fs, dialog, ws } = setup();
    fs.files.set("/proj/a.ts", "alpha needle\nbeta");
    dialog.openFolderResult = "/proj";
    await ws.openFolder();

    const matches = await ws.searchProject("needle");
    expect(matches).toHaveLength(1);
    expect(matches[0].line).toBe(1);
  });

  it("starts watching the folder it opens", async () => {
    const { fs, dialog, watcher, ws } = setup();
    fs.files.set("/proj/a.ts", "x");
    dialog.openFolderResult = "/proj";
    await ws.openFolder();
    expect(watcher.watched).toEqual(["/proj"]);
  });

  it("reloads a clean buffer when its file changes on disk", async () => {
    const { fs, ws } = setup();
    fs.files.set("/a.txt", "v1");
    await ws.openPath("/a.txt");
    const id = ws.layout.activeTabId!;

    fs.files.set("/a.txt", "v2");
    await ws.applyExternalChanges(["/a.txt"]);

    const buf = ws.buffers.get(id)!;
    expect(buf.content).toBe("v2");
    expect(ws.buffers.isDirty(buf)).toBe(false);
  });

  it("suggests a commit message from the staged diff", async () => {
    const { ws, vcs, ai } = setup();
    ws.settings.current = { ...ws.settings.current, aiApiKey: "sk-test" };
    await ws.vcs.refresh("/repo");
    vcs.stagedDiffResult = "+new line";
    ai.deltas = ["feat: add new line\n"];

    expect(await ws.suggestCommitMessage()).toBe("feat: add new line");
    expect(ai.requests[0].messages[0].content).toContain("+new line");
  });

  it("rejects commit suggestion when nothing is staged", async () => {
    const { ws, vcs } = setup();
    ws.settings.current = { ...ws.settings.current, aiApiKey: "sk-test" };
    await ws.vcs.refresh("/repo");
    vcs.stagedDiffResult = "";
    await expect(ws.suggestCommitMessage()).rejects.toThrow("staged");
  });

  it("sends a selection prompt to the AI chat via aiAsk", async () => {
    const { fs, ws, ai } = setup();
    ws.settings.current = { ...ws.settings.current, aiApiKey: "sk-test" };
    fs.files.set("/a.ts", "const x = 1");
    await ws.openPath("/a.ts");
    ws.editorStatus.set(1, 1, 5, "const x");

    ws.aiAsk("explain");
    await new Promise((r) => setTimeout(r, 0));

    expect(ai.requests).toHaveLength(1);
    const prompt = ai.requests[0].messages[0].content;
    expect(prompt).toContain("const x");
    expect(prompt).toContain("a.ts");
    expect(prompt).toContain("Vysvětli");
  });

  it("clones a repo into the picked folder with token auth and opens it", async () => {
    const { dialog, vcs, ws } = setup();
    ws.settings.current = { ...ws.settings.current, githubToken: "ghp_tok" };
    dialog.openFolderResult = "E:/Projekty";

    const target = await ws.cloneRepo("https://github.com/user/facet.git");

    expect(target).toBe("E:/Projekty/facet");
    expect(vcs.cloned).toHaveLength(1);
    expect(vcs.cloned[0].url).toBe("https://github.com/user/facet.git");
    expect(vcs.cloned[0].target).toBe("E:/Projekty/facet");
    expect(vcs.cloned[0].auth).toBe(btoa("x-access-token:ghp_tok"));
    expect(ws.explorer.rootPath).toBe("E:/Projekty/facet");
  });

  it("initRepo initializes git in the opened folder", async () => {
    const { fs, dialog, vcs, ws } = setup();
    fs.files.set("/proj/a.ts", "x");
    dialog.openFolderResult = "/proj";
    vcs.repoStatus = { isRepo: false, branch: null, files: [] };
    await ws.openFolder();

    await ws.initRepo();
    expect(vcs.inits).toEqual(["/proj"]);
  });

  it("parses unstaged hunks and stages selected ones via a patch", async () => {
    const { vcs, ws } = setup();
    await ws.vcs.refresh("/repo");
    vcs.unstagedDiffResult =
      "diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-a\n+b\n";

    const parsed = await ws.fileHunks("a.txt");
    expect(parsed!.hunks).toHaveLength(1);

    await ws.stageHunks(parsed!.fileHeader, parsed!.hunks);
    expect(vcs.appliedPatches).toHaveLength(1);
    expect(vcs.appliedPatches[0]).toContain("diff --git a/a.txt b/a.txt");
    expect(vcs.appliedPatches[0]).toContain("+b");
  });

  it("does not apply a patch when no hunks are chosen", async () => {
    const { vcs, ws } = setup();
    await ws.vcs.refresh("/repo");
    await ws.stageHunks("header\n", []);
    expect(vcs.appliedPatches).toHaveLength(0);
  });

  it("lists GitHub pull requests of the origin remote with the saved token", async () => {
    const { vcs, github, ws } = setup();
    ws.settings.current = { ...ws.settings.current, githubToken: "ghp_tok" };
    await ws.vcs.refresh("/repo");
    vcs.remoteUrlResult = "https://github.com/Elerdir/facet.git";
    github.pulls = [
      { number: 7, title: "Fix", author: "Elerdir", url: "u", draft: false, headRef: "fix" },
    ];

    const prs = await ws.listPullRequests();
    expect(prs).toHaveLength(1);
    expect(github.calls[0].ref).toEqual({ owner: "Elerdir", repo: "facet" });
    expect(github.calls[0].token).toBe("ghp_tok");
  });

  it("rejects PR listing when the remote is not GitHub", async () => {
    const { vcs, ws } = setup();
    await ws.vcs.refresh("/repo");
    vcs.remoteUrlResult = "https://gitlab.com/u/r.git";
    await expect(ws.listPullRequests()).rejects.toThrow("GitHub");
  });

  it("restores the previous session: folder, files, untitled and active tab", async () => {
    const { fs, ws } = setup();
    fs.files.set("/proj/a.ts", "const a = 1");
    fs.files.set("/proj/b.md", "# b");
    fs.dirs.set("/proj", []);

    const restored = await ws.restoreFromData({
      untitled: [{ name: "bez názvu 1", content: "poznámka" }],
      folder: "/proj",
      files: ["/proj/a.ts", "/proj/b.md"],
      activePath: "/proj/a.ts",
    });

    expect(restored).toBe(3);
    expect(ws.explorer.rootPath).toBe("/proj");
    expect(ws.buffers.items.map((b) => b.name)).toEqual([
      "a.ts",
      "b.md",
      "bez názvu 1",
    ]);
    const active = ws.buffers.get(ws.layout.activeTabId!)!;
    expect(active.path).toBe("/proj/a.ts");
  });

  it("skips session files that no longer exist", async () => {
    const { fs, ws } = setup();
    fs.files.set("/proj/keep.ts", "x");

    const restored = await ws.restoreFromData({
      untitled: [],
      folder: null,
      files: ["/proj/keep.ts", "/proj/deleted.ts"],
      activePath: null,
    });

    expect(restored).toBe(1);
    expect(ws.buffers.items).toHaveLength(1);
    expect(ws.buffers.items[0].name).toBe("keep.ts");
  });

  it("creates a new file from a template with extension and content", () => {
    const { ws } = setup();
    ws.newFileFromTemplate({
      id: "rust-main",
      language: "Rust",
      name: "Program",
      extension: "rs",
      content: "fn main() {}\n",
      builtin: true,
    });
    const buf = ws.buffers.get(ws.layout.activeTabId!)!;
    expect(buf.name.endsWith(".rs")).toBe(true);
    expect(buf.content).toBe("fn main() {}\n");
    expect(buf.path).toBeNull();
  });

  it("converts the active file's encoding and rewrites it", async () => {
    const { fs, ws } = setup();
    fs.files.set("/a.txt", "Žluťoučký");
    await ws.openPath("/a.txt");

    await ws.convertEncoding("utf-16le");

    const buf = ws.buffers.get(ws.layout.activeTabId!)!;
    expect(buf.encoding).toBe("utf-16le");
    expect(fs.writtenEncodings.get("/a.txt")).toBe("utf-16le");
    expect(ws.buffers.isDirty(buf)).toBe(false);
  });

  it("keeps unsaved local edits when the file changes externally", async () => {
    const { fs, ws } = setup();
    fs.files.set("/a.txt", "v1");
    await ws.openPath("/a.txt");
    const id = ws.layout.activeTabId!;
    ws.setContent(id, "local edit");

    fs.files.set("/a.txt", "v2");
    await ws.applyExternalChanges(["/a.txt"]);

    expect(ws.buffers.get(id)!.content).toBe("local edit");
  });
});
