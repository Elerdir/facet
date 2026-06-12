/**
 * LSP wire protocol (JSON-RPC over `Content-Length`-framed messages).
 * Pure and fully unit-testable: framing is byte-accurate so multibyte content
 * and split/coalesced chunks are handled correctly.
 */

export interface JsonRpcMessage {
  jsonrpc?: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

const encoder = new TextEncoder();

/** Frame a message into the LSP wire format (header + JSON body). */
export function encodeMessage(message: object): Uint8Array {
  const body = encoder.encode(JSON.stringify(message));
  const header = encoder.encode(`Content-Length: ${body.length}\r\n\r\n`);
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

function indexOfDoubleCRLF(buf: Uint8Array): number {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
      return i;
    }
  }
  return -1;
}

/** Accumulates raw bytes from a stream and yields complete LSP messages. */
export class MessageBuffer {
  #buf = new Uint8Array(0);
  #decoder = new TextDecoder();

  append(chunk: Uint8Array): JsonRpcMessage[] {
    const merged = new Uint8Array(this.#buf.length + chunk.length);
    merged.set(this.#buf, 0);
    merged.set(chunk, this.#buf.length);
    this.#buf = merged;

    const messages: JsonRpcMessage[] = [];
    for (;;) {
      const headerEnd = indexOfDoubleCRLF(this.#buf);
      if (headerEnd < 0) break;
      const header = this.#decoder.decode(this.#buf.subarray(0, headerEnd));
      const match = /content-length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.#buf = this.#buf.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.#buf.length < bodyStart + length) break; // body not fully arrived
      const body = this.#buf.subarray(bodyStart, bodyStart + length);
      try {
        messages.push(JSON.parse(this.#decoder.decode(body)) as JsonRpcMessage);
      } catch {
        // skip a malformed message
      }
      this.#buf = this.#buf.subarray(bodyStart + length);
    }
    return messages;
  }
}
