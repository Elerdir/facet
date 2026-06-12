import type Anthropic from "@anthropic-ai/sdk";
import { modelSupportsAdaptive } from "../domain/ai";
import type { AiPort, AiRequest } from "../ports/ai";

/**
 * AiPort backed by the official Anthropic SDK.
 *
 * Runs in the Tauri webview: `dangerouslyAllowBrowser` is appropriate here —
 * this is the user's own desktop app calling out with their own key stored
 * locally (not a hosted page exposing a shared secret).
 */
export class ClaudeAi implements AiPort {
  #clients = new Map<string, Anthropic>();

  // The SDK is dynamically imported so it stays out of the startup bundle —
  // it loads on the first AI request.
  async #client(apiKey: string): Promise<Anthropic> {
    let client = this.#clients.get(apiKey);
    if (!client) {
      const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
      client = new AnthropicSdk({ apiKey, dangerouslyAllowBrowser: true });
      this.#clients.set(apiKey, client);
    }
    return client;
  }

  async stream(
    request: AiRequest,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const client = await this.#client(request.apiKey);
    const stream = client.messages.stream(
      {
        model: request.model,
        // Editor-sized answers; deliberate cost cap rather than the 64K ceiling.
        max_tokens: 8192,
        ...(request.system ? { system: request.system } : {}),
        ...(modelSupportsAdaptive(request.model)
          ? { thinking: { type: "adaptive" as const } }
          : {}),
        messages: request.messages,
      },
      signal ? { signal } : undefined,
    );
    stream.on("text", onDelta);
    const final = await stream.finalMessage();
    return final.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
  }
}
