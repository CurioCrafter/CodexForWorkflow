import { describe, expect, it } from "vitest";
import { TaskSessionManager } from "./taskSessionManager";

describe("TaskSessionManager screen-share tool routing", () => {
  it("rejects browser action tools in observe-only screen-share mode", async () => {
    const manager = new TaskSessionManager({
      appRoot: process.cwd(),
      userDataPath: process.cwd(),
      cwd: process.cwd()
    });

    (manager as unknown as { state: { session: { environment: string; status: string } } }).state.session = {
      environment: "screen-share",
      status: "running"
    };

    const result = (await manager.handleToolForTest("browser_act", {
      action: { type: "click", x: 10, y: 10 }
    })) as { ok: boolean; denied: boolean; message: string };

    expect(result.ok).toBe(false);
    expect(result.denied).toBe(true);
    expect(result.message).toMatch(/observe-only screen-share/);
  });
});
