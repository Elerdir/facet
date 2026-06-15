import {
  buildSystemPrompt,
  buildInlineEditPrompt,
  INLINE_EDIT_SYSTEM,
  type AiMessage,
  type AiModelInfo,
  type FileContext,
} from "../domain/ai";
import type { AiPort } from "../ports/ai";
import type { SettingsStore } from "./settings.svelte";

/**
 * Reactive AI chat: holds the conversation, streams the assistant reply into
 * the last message, and offers one-shot completions (commit messages). All
 * provider specifics live behind AiPort.
 */
export class AiChatStore {
  messages = $state<AiMessage[]>([]);
  streaming = $state(false);
  error = $state<string | null>(null);
  /** Whether to attach the active file as context to chat messages. */
  includeFileContext = $state(true);

  #port: AiPort;
  #settings: SettingsStore;
  #abort: AbortController | null = null;

  constructor(port: AiPort, settings: SettingsStore) {
    this.#port = port;
    this.#settings = settings;
  }

  get configured(): boolean {
    return this.#settings.current.aiApiKey.trim() !== "";
  }

  /** Current selectable models for the configured key (live; no legacy). */
  async listModels(): Promise<AiModelInfo[]> {
    const key = this.#settings.current.aiApiKey.trim();
    if (key === "") return [];
    return this.#port.listModels(key);
  }

  async send(text: string, context: FileContext | null = null): Promise<void> {
    const prompt = text.trim();
    if (!prompt || this.streaming) return;
    const cfg = this.#settings.current;
    if (!cfg.aiApiKey.trim()) {
      this.error = "Chybí API klíč — nastav ho v Nastavení (Ctrl+,).";
      return;
    }

    this.error = null;
    const history = this.messages.map((m) => ({ ...m }));
    this.messages.push({ role: "user", content: prompt });
    this.messages.push({ role: "assistant", content: "" });
    const replyIndex = this.messages.length - 1;
    this.streaming = true;
    this.#abort = new AbortController();

    try {
      await this.#port.stream(
        {
          apiKey: cfg.aiApiKey,
          model: cfg.aiModel,
          system: buildSystemPrompt(context),
          messages: [...history, { role: "user", content: prompt }],
        },
        (delta) => {
          this.messages[replyIndex] = {
            role: "assistant",
            content: this.messages[replyIndex].content + delta,
          };
        },
        this.#abort.signal,
      );
    } catch (e) {
      if (!this.#abort?.signal.aborted) {
        this.error = e instanceof Error ? e.message : String(e);
      }
    } finally {
      this.streaming = false;
      this.#abort = null;
    }
  }

  cancel(): void {
    this.#abort?.abort();
  }

  clear(): void {
    this.messages = [];
    this.error = null;
  }

  /** Stream an inline edit: returns the model's replacement for `code`. */
  async inlineEdit(
    instruction: string,
    code: string,
    fileName: string,
    onDelta: (text: string) => void,
  ): Promise<string> {
    const cfg = this.#settings.current;
    if (!cfg.aiApiKey.trim()) {
      throw new Error("Chybí API klíč — nastav ho v Nastavení (Ctrl+,).");
    }
    return this.#port.stream(
      {
        apiKey: cfg.aiApiKey,
        model: cfg.aiModel,
        system: INLINE_EDIT_SYSTEM,
        messages: [{ role: "user", content: buildInlineEditPrompt(instruction, code, fileName) }],
      },
      onDelta,
    );
  }

  /** One-shot completion outside the chat (e.g. a commit message). */
  async complete(prompt: string): Promise<string> {
    const cfg = this.#settings.current;
    if (!cfg.aiApiKey.trim()) {
      throw new Error("Chybí API klíč — nastav ho v Nastavení (Ctrl+,).");
    }
    return this.#port.stream(
      { apiKey: cfg.aiApiKey, model: cfg.aiModel, messages: [{ role: "user", content: prompt }] },
      () => {},
    );
  }
}
