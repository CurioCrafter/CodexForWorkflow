import { describe, expect, it } from "vitest";
import { getTaskControlState, splitDomains } from "./appModel";

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
});

describe("splitDomains", () => {
  it("trims empty comma-separated values", () => {
    expect(splitDomains(" bank, paypal.com,  ,stripe.com ")).toEqual(["bank", "paypal.com", "stripe.com"]);
  });
});
