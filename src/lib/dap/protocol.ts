/**
 * Debug Adapter Protocol wire types. DAP uses the same `Content-Length`-framed
 * transport as LSP, so the byte framing is reused from `lsp/protocol`; only the
 * JSON message shape differs (seq/type/command/event instead of JSON-RPC).
 */

import { encodeMessage, MessageBuffer } from "../lsp/protocol";

/** A single DAP protocol message (request, response or event). */
export interface DapMessage {
  seq: number;
  type: "request" | "response" | "event";
  // request
  command?: string;
  arguments?: unknown;
  // response
  request_seq?: number;
  success?: boolean;
  message?: string;
  body?: unknown;
  // event
  event?: string;
}

/** Frame a DAP message into the wire format (header + JSON body). */
export function encodeDap(message: DapMessage): Uint8Array {
  return encodeMessage(message);
}

/** Accumulates raw adapter bytes and yields complete DAP messages. */
export class DapBuffer extends MessageBuffer<DapMessage> {}
