import { describe, it, expect } from "vitest";
import { SettingsStore } from "./settings.svelte";
import { FakeFileSystem, FakeSecrets } from "./testing/fakes";

// Note: file persistence paths go through Tauri's appConfigDir and are
// best-effort no-ops in jsdom; these tests cover the secret routing.

describe("SettingsStore secrets", () => {
  it("loads secrets from the credential store on load", async () => {
    const secrets = new FakeSecrets();
    secrets.values.set("aiApiKey", "sk-from-keychain");
    secrets.values.set("githubToken", "ghp_from-keychain");
    const store = new SettingsStore(new FakeFileSystem(), secrets);

    await store.load();

    expect(store.current.aiApiKey).toBe("sk-from-keychain");
    expect(store.current.githubToken).toBe("ghp_from-keychain");
  });

  it("routes secret updates into the credential store", async () => {
    const secrets = new FakeSecrets();
    const store = new SettingsStore(new FakeFileSystem(), secrets);

    await store.update({ gitlabToken: "glpat_new", editorFontSize: 15 });

    expect(secrets.values.get("gitlabToken")).toBe("glpat_new");
    expect(store.current.gitlabToken).toBe("glpat_new");
    expect(store.current.editorFontSize).toBe(15);
  });

  it("deletes the stored secret when cleared", async () => {
    const secrets = new FakeSecrets();
    secrets.values.set("aiApiKey", "sk-old");
    const store = new SettingsStore(new FakeFileSystem(), secrets);
    await store.load();

    await store.update({ aiApiKey: "" });

    expect(secrets.values.has("aiApiKey")).toBe(false);
  });

  it("works without a credential store (secrets stay in memory)", async () => {
    const store = new SettingsStore(new FakeFileSystem(), null);
    await store.update({ aiApiKey: "sk-mem" });
    expect(store.current.aiApiKey).toBe("sk-mem");
  });
});
