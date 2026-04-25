import { request } from "node:http";
import readline from "node:readline";

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: string | number;
  method?: string;
  params?: unknown;
}

const { port, token } = parseArgs(process.argv.slice(2));

const tools = [
  {
    name: "browser_observe",
    description:
      "Capture the current isolated browser screenshot, URL, title, viewport, and visible page text.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "browser_act",
    description:
      "Execute one validated action in the isolated browser. Use browser_observe before and after meaningful action sequences.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          oneOf: [
            {
              type: "object",
              properties: { type: { const: "navigate" }, url: { type: "string" } },
              required: ["type", "url"],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: { const: "click" },
                x: { type: "number" },
                y: { type: "number" },
                button: { enum: ["left", "right", "middle"] }
              },
              required: ["type", "x", "y"],
              additionalProperties: false
            },
            {
              type: "object",
              properties: { type: { const: "type" }, text: { type: "string" } },
              required: ["type", "text"],
              additionalProperties: false
            },
            {
              type: "object",
              properties: { type: { const: "key" }, key: { type: "string" } },
              required: ["type", "key"],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: { const: "scroll" },
                deltaX: { type: "number" },
                deltaY: { type: "number" }
              },
              required: ["type", "deltaY"],
              additionalProperties: false
            },
            {
              type: "object",
              properties: { type: { const: "wait" }, ms: { type: "number" } },
              required: ["type", "ms"],
              additionalProperties: false
            },
            {
              type: "object",
              properties: { type: { const: "screenshot" } },
              required: ["type"],
              additionalProperties: false
            }
          ]
        }
      },
      required: ["action"],
      additionalProperties: false
    }
  },
  {
    name: "browser_reset",
    description: "Close and reopen the isolated browser profile for the active task session.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "screen_list_sources",
    description: "List screens and windows available for observe-only screen sharing.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "screen_start",
    description:
      "Start observe-only screen sharing for a source id. If sourceId is omitted, the primary screen is used.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "screen_observe",
    description:
      "Capture the latest screenshot from the selected shared screen or window. This tool cannot click, type, or control the desktop.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "screen_stop",
    description: "Stop observe-only screen sharing.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "screen_pin_source",
    description: "Pin a screen or window source so it remains visible as secondary context.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string" }
      },
      required: ["sourceId"],
      additionalProperties: false
    }
  },
  {
    name: "screen_focus_source",
    description: "Focus a pinned source as the primary Live Work Surface.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string" }
      },
      required: ["sourceId"],
      additionalProperties: false
    }
  },
  {
    name: "screen_observe_workspace",
    description: "Capture the focused source and pinned secondary sources for multi-screen context.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "plan_board_set",
    description: "Set the visible task plan board with observe, decide, act/guide, and verify steps.",
    inputSchema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              kind: { enum: ["observe", "decide", "act", "guide", "verify"] },
              title: { type: "string" },
              detail: { type: "string" },
              confidence: { type: "number" },
              risk: { enum: ["low", "medium", "high"] },
              blockedReason: { type: "string" }
            },
            required: ["kind", "title"],
            additionalProperties: true
          }
        }
      },
      required: ["steps"],
      additionalProperties: false
    }
  },
  {
    name: "plan_step_update",
    description: "Update one Plan Board step status.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string" },
        status: { enum: ["pending", "active", "completed", "blocked", "skipped"] },
        blockedReason: { type: "string" }
      },
      required: ["stepId", "status"],
      additionalProperties: false
    }
  },
  {
    name: "mouse_plan_propose",
    description:
      "Render a visible mouse-intent plan. In screen-share mode this is guidance only; in browser mode it can be approved by the user before execution.",
    inputSchema: {
      type: "object",
      properties: {
        plan: {
          type: "object",
          properties: {
            sourceId: { type: "string" },
            sourceName: { type: "string" },
            viewport: {
              type: "object",
              properties: {
                width: { type: "number" },
                height: { type: "number" }
              },
              required: ["width", "height"],
              additionalProperties: false
            },
            x: { type: "number" },
            y: { type: "number" },
            intent: { enum: ["click", "type", "scroll", "navigate", "observe", "guide"] },
            label: { type: "string" },
            rationale: { type: "string" },
            risk: { enum: ["low", "medium", "high"] },
            action: { type: "object" }
          },
          required: ["x", "y", "intent", "label", "rationale"],
          additionalProperties: true
        }
      },
      required: ["plan"],
      additionalProperties: false
    }
  }
];

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  let message: JsonRpcRequest;
  try {
    message = JSON.parse(line) as JsonRpcRequest;
  } catch {
    return;
  }

  if (!message.method) {
    return;
  }

  try {
    const result = await handleMethod(message.method, message.params);
    if (message.id !== undefined) {
      write({ jsonrpc: "2.0", id: message.id, result });
    }
  } catch (error) {
    if (message.id !== undefined) {
      write({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
});

async function handleMethod(method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "codex-for-workflow", version: "0.1.0" }
      };
    case "notifications/initialized":
      return {};
    case "tools/list":
      return { tools };
    case "tools/call": {
      const call = params as { name?: string; arguments?: unknown };
      if (!call?.name) {
        throw new Error("Tool name is required.");
      }
      const result = await callBridge(call.name, call.arguments ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: Boolean((result as { ok?: boolean }).ok === false)
      };
    }
    default:
      return {};
  }
}

function callBridge(tool: string, args: unknown): Promise<unknown> {
  const payload = JSON.stringify({ tool, arguments: args });

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/tool",
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(body));
            return;
          }
          resolve(JSON.parse(body));
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function parseArgs(args: string[]): { port: number; token: string } {
  const portIndex = args.indexOf("--port");
  const tokenIndex = args.indexOf("--token");
  const parsedPort = portIndex >= 0 ? Number(args[portIndex + 1]) : Number.NaN;
  const parsedToken = tokenIndex >= 0 ? args[tokenIndex + 1] : "";

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || !parsedToken) {
    throw new Error("Usage: mcp-browser-server --port <port> --token <token>");
  }

  return { port: parsedPort, token: parsedToken };
}

function write(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
