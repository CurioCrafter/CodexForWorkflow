import { describe, expect, it } from "vitest";
import { TaskSessionManager } from "./taskSessionManager";

describe("TaskSessionManager screen-share tool routing", () => {
  function createManager(): TaskSessionManager {
    return new TaskSessionManager({
      appRoot: process.cwd(),
      userDataPath: process.cwd(),
      cwd: process.cwd()
    });
  }

  function setScreenShareSession(manager: TaskSessionManager): void {
    (manager as unknown as { state: { session: { environment: string; status: string } } }).state.session = {
      environment: "screen-share",
      status: "running"
    };
  }

  it("rejects browser action tools in observe-only screen-share mode", async () => {
    const manager = createManager();
    setScreenShareSession(manager);

    const result = (await manager.handleToolForTest("browser_act", {
      action: { type: "click", x: 10, y: 10 }
    })) as { ok: boolean; denied: boolean; message: string };

    expect(result.ok).toBe(false);
    expect(result.denied).toBe(true);
    expect(result.message).toMatch(/observe-only screen-share/);
  });

  it("rejects browser reset in observe-only screen-share mode", async () => {
    const manager = createManager();
    setScreenShareSession(manager);

    const result = (await manager.handleToolForTest("browser_reset", {})) as {
      ok: boolean;
      denied: boolean;
      message: string;
    };

    expect(result.ok).toBe(false);
    expect(result.denied).toBe(true);
    expect(result.message).toMatch(/observe-only screen-share/);
  });

  it("keeps mouse plans guidance-only in screen-share mode", async () => {
    const manager = createManager();
    setScreenShareSession(manager);

    const result = (await manager.handleToolForTest("mouse_plan_propose", {
      plan: {
        viewport: { width: 100, height: 100 },
        x: 50,
        y: 50,
        intent: "click",
        label: "Click the safe target",
        rationale: "The user should do this manually.",
        risk: "low"
      }
    })) as { ok: boolean; mousePlan: { executionMode: string; environment: string } };

    expect(result.ok).toBe(true);
    expect(result.mousePlan.environment).toBe("screen-share");
    expect(result.mousePlan.executionMode).toBe("screen-guidance");
  });

  it("clears pending approvals when stopped", async () => {
    const manager = new TaskSessionManager({
      appRoot: process.cwd(),
      userDataPath: process.cwd(),
      cwd: process.cwd()
    });

    const privateManager = manager as unknown as {
      state: {
        session: { id: string; environment: "isolated-browser"; status: "running"; task: string; model: string; requestedModel: string; startedAt: string; approvalMode: "confirm-risky" };
        pendingApprovals: Array<{ id: string }>;
      };
      pendingApprovals: Map<string, unknown>;
    };
    privateManager.state.session = {
      id: "session",
      environment: "isolated-browser",
      status: "running"
      ,
      task: "task",
      model: "gpt-5.5",
      requestedModel: "gpt-5.5",
      startedAt: new Date(0).toISOString(),
      approvalMode: "confirm-risky"
    };
    privateManager.state.pendingApprovals = [{ id: "approval" }];
    privateManager.pendingApprovals.set("approval", {});

    await manager.stopTask();

    expect(manager.getState().pendingApprovals).toEqual([]);
    expect(manager.getState().session?.status).toBe("stopped");
  });
});
