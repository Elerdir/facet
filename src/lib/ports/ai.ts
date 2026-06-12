import type { AiMessage } from "../domain/ai";

export interface AiRequest {
  apiKey: string;
  model: string;
  system?: string;
  messages: AiMessage[];
}

/**
 * Port for an AI completion provider. Production wires the Claude adapter
 * (official Anthropic SDK); tests use a scripted fake. Another provider
 * (OpenAI, local LM Studio) is just another implementation.
 */
export interface AiPort {
  /**
   * Stream a completion: `onDelta` receives text chunks as they arrive;
   * resolves with the full text. `signal` cancels the request.
   */
  stream(
    request: AiRequest,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string>;
}
