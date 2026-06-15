import { describe, it, expect } from "vitest";
import { AiChatStore } from "./ai.svelte";
import { SettingsStore } from "./settings.svelte";
import { DEFAULT_SETTINGS } from "../config/settings";
import { FakeAi, FakeFileSystem } from "./testing/fakes";

function setup(apiKey = "sk-test") {
  const settings = new SettingsStore(new FakeFileSystem());
  settings.current = { ...DEFAULT_SETTINGS, aiApiKey: apiKey };
  const port = new FakeAi();
  const store = new AiChatStore(port, settings);
  return { settings, port, store };
}

describe("AiChatStore", () => {
  it("streams the reply into the conversation", async () => {
    const { port, store } = setup();
    port.deltas = ["Ahoj", ", světe"];
    await store.send("Pozdrav");
    expect(store.messages).toEqual([
      { role: "user", content: "Pozdrav" },
      { role: "assistant", content: "Ahoj, světe" },
    ]);
    expect(store.streaming).toBe(false);
    expect(port.requests[0].model).toBe(DEFAULT_SETTINGS.aiModel);
  });

  it("embeds the file context into the system prompt", async () => {
    const { port, store } = setup();
    await store.send("Co dělá ten kód?", [{ name: "main.rs", content: "fn main() {}" }]);
    expect(port.requests[0].system).toContain("main.rs");
    expect(port.requests[0].system).toContain("fn main() {}");
  });

  it("refuses to send without an API key", async () => {
    const { store, port } = setup("");
    await store.send("ahoj");
    expect(store.error).toContain("API klíč");
    expect(port.requests).toHaveLength(0);
  });

  it("captures provider errors and stops streaming", async () => {
    const { port, store } = setup();
    port.failWith = "rate limited";
    await store.send("ahoj");
    expect(store.error).toContain("rate limited");
    expect(store.streaming).toBe(false);
  });

  it("sends prior turns as history", async () => {
    const { port, store } = setup();
    await store.send("první");
    await store.send("druhá");
    expect(port.requests[1].messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
  });

  it("complete returns a one-shot answer without touching the chat", async () => {
    const { port, store } = setup();
    port.deltas = ["fix: ", "update"];
    expect(await store.complete("commit")).toBe("fix: update");
    expect(store.messages).toHaveLength(0);
  });

  it("ghostComplete returns the stripped suggestion", async () => {
    const { port, store } = setup();
    port.deltas = ["```ts\n", "console.log(x);", "\n```"];
    const out = await store.ghostComplete("const x = 1;\n", "", "a.ts", new AbortController().signal);
    expect(out).toBe("console.log(x);");
    expect(port.requests[0].maxTokens).toBe(256);
    expect(port.requests[0].system).toContain("doplňování");
  });

  it("ghostComplete returns empty without an API key", async () => {
    const { store, settings } = setup();
    settings.current = { ...settings.current, aiApiKey: "" };
    expect(await store.ghostComplete("a", "b", "a.ts", new AbortController().signal)).toBe("");
  });

  it("clear resets the conversation", async () => {
    const { store } = setup();
    await store.send("ahoj");
    store.clear();
    expect(store.messages).toHaveLength(0);
    expect(store.error).toBeNull();
  });
});
