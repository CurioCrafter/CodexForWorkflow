import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";

export interface BridgeRequest {
  tool: string;
  arguments: unknown;
}

export type BridgeHandler = (request: BridgeRequest) => Promise<unknown>;

export class LoopbackBridge {
  private server?: Server;
  private token = randomBytes(24).toString("hex");
  private port?: number;

  constructor(private readonly handler: BridgeHandler) {}

  async start(): Promise<{ port: number; token: string }> {
    if (this.server && this.port) {
      return { port: this.port, token: this.token };
    }

    this.server = createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        writeJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(0, "127.0.0.1", () => resolve());
    });

    const address = this.server.address() as AddressInfo;
    this.port = address.port;
    return { port: this.port, token: this.token };
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
    this.server = undefined;
    this.port = undefined;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "POST" || request.url !== "/tool") {
      writeJson(response, 404, { error: "Not found." });
      return;
    }

    const auth = request.headers.authorization;
    if (auth !== `Bearer ${this.token}`) {
      writeJson(response, 401, { error: "Unauthorized." });
      return;
    }

    const body = await readBody(request);
    const parsed = JSON.parse(body) as BridgeRequest;
    const result = await this.handler(parsed);
    writeJson(response, 200, result);
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}
