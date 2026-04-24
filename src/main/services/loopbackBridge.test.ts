import { request } from "node:http";
import { describe, expect, it } from "vitest";
import { LoopbackBridge } from "./loopbackBridge";

describe("LoopbackBridge", () => {
  it("requires the session token and forwards tool calls", async () => {
    const bridge = new LoopbackBridge(async (message) => ({
      ok: true,
      tool: message.tool,
      arguments: message.arguments
    }));
    const { port, token } = await bridge.start();

    try {
      const result = await post(port, token, { tool: "browser_observe", arguments: {} });
      expect(result).toEqual({ ok: true, tool: "browser_observe", arguments: {} });

      await expect(post(port, "wrong", { tool: "browser_observe", arguments: {} })).rejects.toThrow(
        /401/
      );
    } finally {
      await bridge.stop();
    }
  });
});

function post(port: number, token: string, payload: unknown): Promise<unknown> {
  const body = JSON.stringify(payload);
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
          "content-length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`${res.statusCode}: ${responseBody}`));
            return;
          }
          resolve(JSON.parse(responseBody));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
