import { encodeDap, DapBuffer, type DapMessage } from "../dap/protocol";
import type { AdapterSpec } from "../dap/adapters";
import type { DapTransport } from "../ports/dap";
import {
  parseThreads,
  parseStackFrames,
  parseScopes,
  parseVariables,
  type DapThread,
  type DapStackFrame,
  type DapScope,
  type DapVariable,
} from "../dap/session";

export type DebugState =
  | "inactive"
  | "starting"
  | "running"
  | "stopped"
  | "terminated";

export interface OutputLine {
  category: string;
  text: string;
}

/** A scope plus its (lazily fetched) variables, for the Variables tree. */
export interface ScopeView extends DapScope {
  variables: DapVariable[];
}

interface Pending {
  resolve: (body: unknown) => void;
  reject: (error: unknown) => void;
}

const SESSION_ID = "dap";

/**
 * Drives a single debug adapter session over a `DapTransport`. Owns the DAP
 * lifecycle (initialize → launch → configurationDone), request correlation,
 * event handling and the reactive debug state the UI renders. Pure logic —
 * fully unit-testable with a fake transport.
 */
export class DebugManager {
  state = $state<DebugState>("inactive");
  threads = $state<DapThread[]>([]);
  frames = $state<DapStackFrame[]>([]);
  scopes = $state<ScopeView[]>([]);
  output = $state<OutputLine[]>([]);
  stoppedThreadId = $state<number | null>(null);
  currentFrameId = $state<number | null>(null);
  /** Source location of the current frame, for the editor's stop highlight. */
  currentLocation = $state<{ path: string; line: number } | null>(null);
  /** Last error surfaced while starting/driving the session. */
  error = $state<string | null>(null);

  #transport: DapTransport;
  #buffer = new DapBuffer();
  #seq = 1;
  #pending = new Map<number, Pending>();
  #spec: AdapterSpec | null = null;
  #breakpoints: { path: string; lines: number[] }[] = [];

  constructor(transport: DapTransport) {
    this.#transport = transport;
    transport.onData((id, bytes) => {
      if (id === SESSION_ID) this.#onData(bytes);
    });
    transport.onExit((id) => {
      if (id === SESSION_ID) this.#reset("terminated");
    });
  }

  get active(): boolean {
    return this.state !== "inactive" && this.state !== "terminated";
  }

  /** Launch `program` under the adapter, with the given breakpoints. */
  async start(
    spec: AdapterSpec,
    launchArgs: Record<string, unknown>,
    cwd: string,
    breakpoints: { path: string; lines: number[] }[],
  ): Promise<void> {
    if (this.active) await this.stop();
    this.#reset("starting");
    this.#spec = spec;
    this.#breakpoints = breakpoints;
    this.error = null;
    try {
      await this.#transport.start(SESSION_ID, spec.command, spec.args, cwd);
      await this.#request("initialize", {
        clientID: "facet",
        clientName: "Facet",
        adapterID: spec.adapterId,
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsRunInTerminalRequest: false,
      });
      // Launch may only resolve after configurationDone; don't block on it.
      void this.#request("launch", launchArgs).catch((e) => {
        this.error = e instanceof Error ? e.message : String(e);
      });
      // The adapter answers with an `initialized` event → see #onEvent.
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.#reset("terminated");
    }
  }

  continue(): void {
    this.#step("continue");
  }
  next(): void {
    this.#step("next");
  }
  stepIn(): void {
    this.#step("stepIn");
  }
  stepOut(): void {
    this.#step("stepOut");
  }

  pause(): void {
    if (this.stoppedThreadId === null && this.threads[0]) {
      this.#request("pause", { threadId: this.threads[0].id }).catch(() => {});
    }
  }

  /** Terminate the session and tear down the adapter. */
  async stop(): Promise<void> {
    if (!this.active) {
      this.#reset("inactive");
      return;
    }
    try {
      await this.#request("disconnect", { terminateDebuggee: true });
    } catch {
      // adapter may already be gone
    }
    await this.#transport.stop(SESSION_ID).catch(() => {});
    this.#reset("inactive");
  }

  /** Switch the inspected frame and refresh its variables + stop location. */
  async selectFrame(frameId: number): Promise<void> {
    const frame = this.frames.find((f) => f.id === frameId);
    if (!frame) return;
    this.currentFrameId = frameId;
    this.currentLocation = frame.path ? { path: frame.path, line: frame.line } : null;
    await this.#loadScopes(frameId);
  }

  // --- internals -----------------------------------------------------------

  #step(command: string): void {
    if (this.stoppedThreadId === null) return;
    const threadId = this.stoppedThreadId;
    this.state = "running";
    this.currentLocation = null;
    this.#request(command, { threadId }).catch(() => {});
  }

  #request(command: string, args: unknown): Promise<unknown> {
    const seq = this.#seq++;
    const promise = new Promise<unknown>((resolve, reject) =>
      this.#pending.set(seq, { resolve, reject }),
    );
    void this.#transport.send(
      SESSION_ID,
      encodeDap({ seq, type: "request", command, arguments: args }),
    );
    return promise;
  }

  #onData(bytes: Uint8Array): void {
    for (const msg of this.#buffer.append(bytes)) this.#dispatch(msg);
  }

  #dispatch(msg: DapMessage): void {
    if (msg.type === "response") {
      const seq = msg.request_seq;
      if (typeof seq === "number" && this.#pending.has(seq)) {
        const pending = this.#pending.get(seq)!;
        this.#pending.delete(seq);
        if (msg.success === false) pending.reject(new Error(msg.message ?? "DAP chyba"));
        else pending.resolve(msg.body);
      }
      return;
    }
    if (msg.type === "event") {
      this.#onEvent(msg.event ?? "", msg.body);
      return;
    }
    // Reverse request from the adapter: acknowledge so it doesn't block.
    if (msg.type === "request" && typeof msg.seq === "number") {
      void this.#transport.send(
        SESSION_ID,
        encodeDap({
          seq: this.#seq++,
          type: "response",
          request_seq: msg.seq,
          command: msg.command,
          success: true,
        }),
      );
    }
  }

  #onEvent(event: string, body: unknown): void {
    switch (event) {
      case "initialized":
        void this.#configure();
        break;
      case "stopped":
        void this.#onStopped(body as { threadId?: number; reason?: string });
        break;
      case "continued":
        this.state = "running";
        this.currentLocation = null;
        this.stoppedThreadId = null;
        break;
      case "output": {
        const o = body as { category?: string; output?: string };
        if (o.output) {
          this.output = [
            ...this.output,
            { category: o.category ?? "console", text: o.output },
          ];
        }
        break;
      }
      case "thread":
        void this.#loadThreads();
        break;
      case "terminated":
      case "exited":
        this.#reset("terminated");
        break;
    }
  }

  /** After `initialized`: send breakpoints for each file, then finish config. */
  async #configure(): Promise<void> {
    for (const { path, lines } of this.#breakpoints) {
      const name = path.split(/[\\/]/).pop() ?? path;
      await this.#request("setBreakpoints", {
        source: { path, name },
        breakpoints: lines.map((line) => ({ line })),
        lines,
      }).catch(() => {});
    }
    await this.#request("configurationDone", {}).catch(() => {});
    this.state = "running";
  }

  async #onStopped(body: { threadId?: number; reason?: string }): Promise<void> {
    this.state = "stopped";
    const threadId = body.threadId ?? this.stoppedThreadId ?? this.threads[0]?.id ?? 0;
    this.stoppedThreadId = threadId;
    await this.#loadThreads();
    const trace = await this.#request("stackTrace", {
      threadId,
      startFrame: 0,
      levels: 20,
    }).catch(() => null);
    this.frames = parseStackFrames(trace);
    const top = this.frames[0];
    if (top) {
      this.currentFrameId = top.id;
      this.currentLocation = top.path ? { path: top.path, line: top.line } : null;
      await this.#loadScopes(top.id);
    } else {
      this.currentFrameId = null;
      this.currentLocation = null;
      this.scopes = [];
    }
  }

  async #loadThreads(): Promise<void> {
    const body = await this.#request("threads", {}).catch(() => null);
    if (body) this.threads = parseThreads(body);
  }

  async #loadScopes(frameId: number): Promise<void> {
    const body = await this.#request("scopes", { frameId }).catch(() => null);
    const scopes = parseScopes(body);
    const views: ScopeView[] = [];
    for (const scope of scopes) {
      const vars = scope.expensive
        ? []
        : parseVariables(
            await this.#request("variables", {
              variablesReference: scope.variablesReference,
            }).catch(() => null),
          );
      views.push({ ...scope, variables: vars });
    }
    this.scopes = views;
  }

  #reset(state: DebugState): void {
    this.state = state;
    this.threads = [];
    this.frames = [];
    this.scopes = [];
    this.stoppedThreadId = null;
    this.currentFrameId = null;
    this.currentLocation = null;
    for (const p of this.#pending.values()) p.reject(new Error("Session ukončena"));
    this.#pending.clear();
    this.#buffer = new DapBuffer();
    this.#seq = 1;
    if (state === "inactive" || state === "terminated") this.#spec = null;
  }
}
