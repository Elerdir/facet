import { describe, it, expect } from "vitest";
import { VcsStore } from "./vcs.svelte";
import { FakeVcs } from "./testing/fakes";

describe("VcsStore", () => {
  it("loads status and groups staged/unstaged", async () => {
    const port = new FakeVcs();
    port.repoStatus = {
      isRepo: true,
      branch: "main",
      files: [
        { path: "a", status: "modified", staged: false },
        { path: "b", status: "added", staged: true },
      ],
    };
    const store = new VcsStore(port);
    await store.refresh("/repo");

    expect(store.status.branch).toBe("main");
    expect(store.grouped.staged.map((f) => f.path)).toEqual(["b"]);
    expect(store.grouped.unstaged.map((f) => f.path)).toEqual(["a"]);
  });

  it("clears to a non-repo state when there is no folder", async () => {
    const store = new VcsStore(new FakeVcs());
    await store.refresh(null);
    expect(store.status.isRepo).toBe(false);
    expect(store.repo).toBeNull();
  });

  it("stages, unstages and commits through the port", async () => {
    const port = new FakeVcs();
    const store = new VcsStore(port);
    await store.refresh("/repo");

    await store.stage("a");
    await store.unstage("b");
    await store.commit("a message");

    expect(port.staged).toEqual(["a"]);
    expect(port.unstaged).toEqual(["b"]);
    expect(port.commits).toEqual(["a message"]);
  });

  it("ignores commit with an empty message", async () => {
    const port = new FakeVcs();
    const store = new VcsStore(port);
    await store.refresh("/repo");
    await store.commit("   ");
    expect(port.commits).toEqual([]);
  });

  it("loads branches and switches / creates them", async () => {
    const port = new FakeVcs();
    port.branchesResult = { current: "main", all: ["main", "dev"] };
    const store = new VcsStore(port);
    await store.refresh("/repo");
    expect(store.branches.current).toBe("main");
    expect(store.branches.all).toEqual(["main", "dev"]);

    await store.switchBranch("dev");
    expect(port.checkouts).toEqual(["dev"]);
    expect(store.branches.current).toBe("dev");

    await store.createBranch("feature");
    expect(port.created).toEqual(["feature"]);
    expect(store.branches.all).toContain("feature");
  });

  it("does not check out the branch that is already current", async () => {
    const port = new FakeVcs();
    port.branchesResult = { current: "main", all: ["main"] };
    const store = new VcsStore(port);
    await store.refresh("/repo");
    await store.switchBranch("main");
    expect(port.checkouts).toEqual([]);
  });

  it("runs sync operations through the port", async () => {
    const port = new FakeVcs();
    const store = new VcsStore(port);
    await store.refresh("/repo");
    const out = await store.sync("push");
    expect(port.syncs).toEqual(["push"]);
    expect(out).toBe("push ok");
  });

  it("passes a token credential to sync based on the remote URL", async () => {
    const port = new FakeVcs();
    port.remoteUrlResult = "https://github.com/u/r.git";
    const store = new VcsStore(port, (url) =>
      url?.includes("github.com") ? "B64CRED" : null,
    );
    await store.refresh("/repo");
    await store.sync("push");
    expect(port.syncAuths).toEqual(["B64CRED"]);
  });

  it("init creates a repo and refreshes status", async () => {
    const port = new FakeVcs();
    port.repoStatus = { isRepo: false, branch: null, files: [] };
    const store = new VcsStore(port);
    await store.init("/folder");
    expect(port.inits).toEqual(["/folder"]);
    expect(store.status.isRepo).toBe(true);
  });

  it("reads and writes the git identity through the port", async () => {
    const port = new FakeVcs();
    const store = new VcsStore(port);
    await store.setIdentity("Ladik", "ladik@example.com");
    expect(await store.getIdentity()).toEqual({ name: "Ladik", email: "ladik@example.com" });
  });

  it("loads the commit log on refresh", async () => {
    const port = new FakeVcs();
    port.logResult = [
      { hash: "abc1234", message: "init", author: "Test", time: 1000 },
    ];
    const store = new VcsStore(port);
    await store.refresh("/repo");
    expect(store.log).toHaveLength(1);
    expect(store.log[0].message).toBe("init");
  });

  it("loads and clears blame", async () => {
    const port = new FakeVcs();
    port.blameResult = [{ line: 1, hash: "abc1234", author: "Test" }];
    const store = new VcsStore(port);
    await store.refresh("/repo");

    await store.loadBlame("/repo/a.txt");
    expect(store.blame?.path).toBe("/repo/a.txt");
    expect(store.blame?.lines).toHaveLength(1);

    store.clearBlame();
    expect(store.blame).toBeNull();
  });
});
