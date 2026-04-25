import { describe, expect, it } from "vitest";
import { buildFollowUpPrompt, getActivePlanStep, getMousePlanInstruction, getStepInstruction, getTaskControlState, splitDomains } from "./appModel";

describe("getTaskControlState", () => {
  it("disables start without a task", () => {
    const state = getTaskControlState({
      busy: false,
      environment: "isolated-browser",
      screenSharing: false,
      status: "idle",
      task: " "
    });

    expect(state.startDisabled).toBe(true);
    expect(state.startReason).toMatch(/Enter a task/);
    expect(state.askDisabled).toBe(true);
  });

  it("requires a selected source for screen-share tasks", () => {
    const state = getTaskControlState({
      busy: false,
      environment: "screen-share",
      screenSharing: false,
      status: "idle",
      task: "guide me"
    });

    expect(state.startDisabled).toBe(true);
    expect(state.startReason).toMatch(/select a source/);
  });

  it("sets pause, resume, and stop states for running statuses", () => {
    expect(getTaskControlState({
      busy: false,
      environment: "isolated-browser",
      screenSharing: false,
      status: "running",
      task: "work"
    })).toMatchObject({
      running: true,
      pauseDisabled: false,
      resumeDisabled: true,
      stopDisabled: false
    });

    expect(getTaskControlState({
      busy: false,
      environment: "isolated-browser",
      screenSharing: false,
      status: "paused",
      task: "work"
    })).toMatchObject({
      running: true,
      pauseDisabled: true,
      resumeDisabled: false,
      stopDisabled: false
    });
  });

  it("allows follow-up commands only while running", () => {
    expect(getTaskControlState({
      busy: false,
      environment: "screen-share",
      screenSharing: true,
      sourceId: "screen",
      status: "running",
      task: "help"
    }).askDisabled).toBe(false);

    expect(getTaskControlState({
      busy: false,
      environment: "screen-share",
      screenSharing: true,
      sourceId: "screen",
      status: "idle",
      task: "help"
    }).askReason).toMatch(/Start a task/);
  });

  it.each([
    ["idle", false, false, true, true],
    ["running", true, true, false, false],
    ["paused", true, true, false, false],
    ["awaiting-approval", true, true, false, false],
    ["stopped", false, false, true, true],
    ["failed", false, false, true, true]
  ] as const)("derives disabled states for %s sessions", (status, running, startDisabled, askDisabled, mousePlanDisabled) => {
    const state = getTaskControlState({
      busy: false,
      environment: "isolated-browser",
      screenSharing: false,
      status,
      task: "work"
    });

    expect(state.running).toBe(running);
    expect(state.startDisabled).toBe(startDisabled);
    expect(state.askDisabled).toBe(askDisabled);
    expect(state.mousePlanDisabled).toBe(mousePlanDisabled);
  });

  it("allows observe when a screen is already shared outside a task", () => {
    const state = getTaskControlState({
      busy: false,
      environment: "screen-share",
      screenSharing: true,
      sourceId: "screen",
      status: undefined,
      task: "help"
    });

    expect(state.observeDisabled).toBe(false);
  });
});

describe("splitDomains", () => {
  it("trims empty comma-separated values", () => {
    expect(splitDomains(" bank, paypal.com,  ,stripe.com ")).toEqual(["bank", "paypal.com", "stripe.com"]);
  });
});

describe("guidance helpers", () => {
  it("derives the active plan step", () => {
    const active = getActivePlanStep([
      { id: "one", kind: "observe", title: "Done", detail: "", status: "completed", confidence: 1, risk: "low" },
      { id: "two", kind: "guide", title: "Now", detail: "", status: "active", confidence: 0.7, risk: "medium" }
    ], "screen-share");

    expect(active.id).toBe("two");
  });

  it("describes screen-share guide steps as manual", () => {
    expect(getStepInstruction({
      id: "guide",
      kind: "guide",
      title: "Click",
      detail: "",
      status: "active",
      confidence: 0.7,
      risk: "low"
    }, "screen-share")).toMatch(/manually/);
  });

  it("describes mouse plans by execution mode", () => {
    expect(getMousePlanInstruction({
      id: "plan",
      environment: "screen-share",
      executionMode: "screen-guidance",
      viewport: { width: 100, height: 100 },
      x: 10,
      y: 10,
      intent: "click",
      label: "Click",
      rationale: "Next",
      risk: "low",
      createdAt: new Date(0).toISOString()
    })).toMatch(/manually/);
  });

  it("builds contextual follow-up prompts", () => {
    expect(buildFollowUpPrompt("mouse", {
      id: "step",
      kind: "guide",
      title: "Open settings",
      detail: "",
      status: "active",
      confidence: 0.8,
      risk: "low"
    })).toMatch(/Open settings/);
  });
});
