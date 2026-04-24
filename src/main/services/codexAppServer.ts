import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import readline from "node:readline";
import { buildCodexArgs, resolveCodexCli } from "./codexCliResolver";
import type { ScreenSource, TaskEnvironment, WorkflowPresetId } from "../../shared/types";
import { redactSensitiveText } from "./redaction";

interface JsonRpcMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface CodexLaunchOptions {
  cwd: string;
  mcpServerPath: string;
  bridgePort: number;
  bridgeToken: string;
}

export interface CodexTurnOptions {
  taskPrompt: string;
  requestedModel: string;
  fallbackModel: string;
}

export interface CodexModelSelection {
  model: string;
  requestedModel: string;
  fellBack: boolean;
  reason?: string;
}

export class CodexAppServerClient extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private threadId?: string;
  private launchOptions?: CodexLaunchOptions;

  async start(options: CodexLaunchOptions): Promise<void> {
    if (this.proc) {
      return;
    }

    this.launchOptions = options;
    const nodeCommand = getNodeCommand();
    const args = [
      "app-server",
      "-c",
      `mcp_servers.browser_pilot.command=${tomlLiteral(nodeCommand.command)}`,
      "-c",
      `mcp_servers.browser_pilot.args=${tomlArray([
        options.mcpServerPath,
        "--port",
        String(options.bridgePort),
        "--token",
        options.bridgeToken
      ])}`
    ];

    if (nodeCommand.electronRunAsNode) {
      args.push("-c", `mcp_servers.browser_pilot.env={ELECTRON_RUN_AS_NODE="1"}`);
    }

    const cli = resolveCodexCli();
    this.emit("event", {
      source: "codex",
      level: "info",
      message: "Resolved Codex CLI.",
      detail: cli.diagnostics
    });

    this.proc = spawn(cli.executable, buildCodexArgs(cli, args), {
      cwd: options.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.proc.on("exit", (code, signal) => {
      this.emit("event", {
        source: "codex",
        level: code === 0 ? "info" : "warning",
        message: `Codex app-server exited (${signal ?? code ?? "unknown"}).`
      });
      this.rejectAll(new Error("Codex app-server exited."));
      this.proc = undefined;
      this.threadId = undefined;
    });

    this.proc.stderr.on("data", (chunk) => {
      const text = redactSensitiveText(String(chunk).trim());
      if (text) {
        this.emit("event", { source: "codex", level: "warning", message: text });
      }
    });

    readline.createInterface({ input: this.proc.stdout }).on("line", (line) => {
      this.handleLine(line);
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex_browser_pilot",
        title: "Codex Browser Pilot",
        version: "0.1.0"
      }
    });
    this.notify("initialized", {});
  }

  async startTurn(options: CodexTurnOptions): Promise<CodexModelSelection> {
    if (!this.proc) {
      throw new Error("Codex app-server has not started.");
    }

    const selection = await this.startThreadWithFallback(options.requestedModel, options.fallbackModel);
    await this.request("turn/start", {
      threadId: this.threadId,
      input: [{ type: "text", text: options.taskPrompt }]
    });
    return selection;
  }

  async stop(): Promise<void> {
    if (!this.proc) {
      return;
    }
    this.proc.kill();
    this.rejectAll(new Error("Codex app-server stopped."));
    this.proc = undefined;
    this.threadId = undefined;
  }

  private async startThreadWithFallback(
    requestedModel: string,
    fallbackModel: string
  ): Promise<CodexModelSelection> {
    try {
      const result = (await this.request("thread/start", { model: requestedModel })) as {
        thread?: { id?: string };
      };
      this.threadId = result.thread?.id;
      if (!this.threadId) {
        throw new Error("Codex did not return a thread id.");
      }
      return { model: requestedModel, requestedModel, fellBack: false };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.emit("event", {
        source: "codex",
        level: "warning",
        message: `Requested model ${requestedModel} was not accepted. Falling back to ${fallbackModel}.`,
        detail: redactSensitiveText(reason)
      });

      const result = (await this.request("thread/start", { model: fallbackModel })) as {
        thread?: { id?: string };
      };
      this.threadId = result.thread?.id;
      if (!this.threadId) {
        throw new Error("Codex did not return a thread id.");
      }
      return { model: fallbackModel, requestedModel, fellBack: true, reason };
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const proc = this.proc;
    if (!proc) {
      return Promise.reject(new Error("Codex app-server is not running."));
    }

    const id = this.nextId++;
    const payload = { method, id, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      proc.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private notify(method: string, params: unknown): void {
    this.proc?.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      this.emit("event", { source: "codex", level: "warning", message: redactSensitiveText(line) });
      return;
    }

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message ?? `Codex error ${message.error.code}`));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    const extracted = extractReadableText(message.params);
    this.emit("notification", message);
    this.emit("event", {
      source: "codex",
      level: notificationLevel(message.method),
      message: readableNotification(message.method, extracted),
      detail: extracted.length > 0 ? redactSensitiveText(extracted.join("\n")) : undefined
    });
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function buildCodexTaskPrompt(
  task: string,
  environment: TaskEnvironment,
  screenSource?: ScreenSource,
  pinnedSources: ScreenSource[] = [],
  workflowPreset?: WorkflowPresetId
): string {
  const sharedPlanInstructions = [
    "Maintain a concise Plan Board using plan_board_set and plan_step_update.",
    "When a visual target matters, propose a Mouse Plan with mouse_plan_propose before acting or guiding.",
    "Use low-risk, reversible steps and verify after each meaningful change."
  ];

  if (environment === "screen-share") {
    return [
      "You are observing the user's selected screen or window through observe-only screen_pilot MCP tools.",
      "Use screen_observe_workspace or screen_observe to inspect the current screenshots before giving guidance.",
      "You cannot click, type, scroll, open apps, or control the live desktop.",
      "Guide the user with concise step-by-step instructions and explain what you are looking at.",
      "If credentials, payments, destructive actions, uploads, or external sends are needed, ask the user to decide and perform the action themselves.",
      ...sharedPlanInstructions,
      screenSource ? `Selected source: ${screenSource.name}` : "Selected source: primary screen",
      pinnedSources.length > 0
        ? `Pinned sources: ${pinnedSources.map((source) => source.name).join(", ")}`
        : "Pinned sources: none",
      workflowPreset ? `Workflow preset: ${workflowPreset}` : "Workflow preset: custom",
      "",
      `User task: ${task}`
    ].join("\n");
  }

  return [
    "You are controlling an isolated browser through the browser_pilot MCP tools.",
    "Use browser_observe to inspect the current screenshot before acting.",
    "Use browser_act for one browser action at a time, then observe again when the page meaningfully changes.",
    "Narrate what you are doing in concise, user-visible progress updates.",
    "Do not ask for secrets. If a login, payment, destructive action, upload, or external send is needed, stop and ask the user for approval through the app.",
    "The app may pause risky browser actions for human approval. Continue from the tool result after approval or denial.",
    ...sharedPlanInstructions,
    workflowPreset ? `Workflow preset: ${workflowPreset}` : "Workflow preset: custom",
    "",
    `User task: ${task}`
  ].join("\n");
}

export function resolveMcpServerPath(appRoot: string): string {
  return path.join(appRoot, "dist", "main", "main", "mcp-browser-server.js");
}

function getNodeCommand(): { command: string; electronRunAsNode: boolean } {
  if (process.versions.electron) {
    return { command: process.execPath, electronRunAsNode: true };
  }
  return { command: process.execPath, electronRunAsNode: false };
}

function tomlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function tomlArray(values: string[]): string {
  return `[${values.map(tomlLiteral).join(", ")}]`;
}

function notificationLevel(method?: string): "info" | "warning" | "error" | "success" {
  if (!method) {
    return "info";
  }
  if (method.includes("error") || method.includes("failed")) {
    return "error";
  }
  if (method.includes("finished") || method.includes("completed")) {
    return "success";
  }
  return "info";
}

function readableNotification(method?: string, extracted: string[] = []): string {
  if (!method) {
    return extracted[0] ?? "Codex event";
  }
  const primary = extracted.find((text) => text.length > 0 && text.length < 220);
  return primary ?? method.replace(/[/:_-]/g, " ");
}

function extractReadableText(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractReadableText(item, depth + 1));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = ["text", "message", "summary", "content", "output"];
    const direct = preferred.flatMap((key) => extractReadableText(record[key], depth + 1));
    if (direct.length > 0) {
      return direct;
    }
    return Object.values(record).flatMap((item) => extractReadableText(item, depth + 1));
  }
  return [];
}
