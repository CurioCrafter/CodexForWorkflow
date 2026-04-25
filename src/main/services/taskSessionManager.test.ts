import { describe, expect, it, vi } from "vitest";
import type { AppState, MousePlan, PlanStep, ScreenObservation, TaskSession } from "../../shared/types";
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

  function setSession(manager: TaskSessionManager, session: Partial<TaskSession>): void {
    (manager as unknown as { state: AppState }).state.session = {
      id: "session",
      environment: "screen-share",
      status: "running",
      task: "Guide me",
      model: "gpt-5.5",
      requestedModel: "gpt-5.5",
      startedAt: new Date(0).toISOString(),
      approvalMode: "confirm-risky",
      ...session
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

  it("rejects empty follow-up commands", async () => {
    const manager = createManager();
    setSession(manager, {});

    await expect(manager.sendCommand("   ")).rejects.toThrow(/Follow-up command/);
  });

  it("requires an active Codex session before follow-up commands", async () => {
    const manager = createManager();

    await expect(manager.sendCommand("What next?")).rejects.toThrow(/Start a task/);
  });

  it("sends follow-up commands into the active Codex thread and logs them", async () => {
    const manager = createManager();
    setSession(manager, {});
    const sendCommand = vi.fn().mockResolvedValue(undefined);
    (manager as unknown as { codex: { sendCommand: typeof sendCommand } }).codex = { sendCommand };

    await manager.sendCommand("What is the next step?");

    expect(sendCommand).toHaveBeenCalledWith("What is the next step?");
    expect(manager.getState().timeline[0].message).toMatch(/Asked Codex/);
  });

  it("refreshes screen-share observations without desktop input", async () => {
    const manager = createManager();
    setSession(manager, { environment: "screen-share" });
    const observation: ScreenObservation = {
      environment: "screen-share",
      screenshot: "data:image/png;base64,screen",
      viewport: { width: 1200, height: 800 },
      sourceId: "screen-1",
      sourceName: "Primary screen",
      timestamp: new Date(0).toISOString()
    };
    const observeSources = vi.fn().mockResolvedValue([observation]);
    const execute = vi.fn();
    const privateManager = manager as unknown as {
      state: AppState;
      screenShare: { observeSources: typeof observeSources };
      harness: { execute: typeof execute };
    };
    privateManager.state.screenSharing = true;
    privateManager.state.screenWorkspace = {
      sources: [{ id: "screen-1", name: "Primary screen", type: "screen" }],
      pinnedSourceIds: ["screen-1"],
      focusedSourceId: "screen-1",
      observations: {}
    };
    privateManager.screenShare = { observeSources };
    privateManager.harness = { execute };

    await manager.observeCurrent();

    expect(observeSources).toHaveBeenCalledWith(["screen-1"]);
    expect(execute).not.toHaveBeenCalled();
    expect(manager.getState().observation).toMatchObject({ sourceId: "screen-1" });
  });

  it("updates user-controlled plan steps and advances the next pending step", () => {
    const manager = createManager();
    const steps: PlanStep[] = [
      { id: "observe", kind: "observe", title: "Observe", detail: "", status: "active", confidence: 0.9, risk: "low" },
      { id: "guide", kind: "guide", title: "Guide", detail: "", status: "pending", confidence: 0.7, risk: "medium" }
    ];
    (manager as unknown as { state: AppState }).state.planSteps = steps;

    manager.updatePlanStepFromUser("observe", "completed");

    expect(manager.getState().planSteps).toMatchObject([
      { id: "observe", status: "completed" },
      { id: "guide", status: "active" }
    ]);
    expect(manager.getState().timeline[0].message).toBe("Plan step completed: Observe");
  });

  it("never executes desktop input when confirming a screen-share Mouse Plan", async () => {
    const manager = createManager();
    const execute = vi.fn();
    const mousePlan: MousePlan = {
      id: "plan",
      environment: "screen-share",
      executionMode: "screen-guidance",
      viewport: { width: 100, height: 100 },
      x: 30,
      y: 40,
      intent: "click",
      label: "Click manually",
      rationale: "The user does this on the shared desktop.",
      risk: "low",
      createdAt: new Date(0).toISOString()
    };
    const privateManager = manager as unknown as { state: AppState; harness: { execute: typeof execute } };
    privateManager.state.mousePlan = mousePlan;
    privateManager.harness = { execute };

    await manager.resolveMousePlan(true);

    expect(execute).not.toHaveBeenCalled();
    expect(manager.getState().mousePlan).toBeUndefined();
    expect(manager.getState().timeline[0].message).toMatch(/Use the highlighted target/);
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
