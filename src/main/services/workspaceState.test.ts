import { describe, expect, it } from "vitest";
import type { ScreenSource } from "../../shared/types";
import {
  createEmptyScreenWorkspace,
  focusScreenSource,
  mergeScreenObservations,
  pinScreenSource,
  reconcileScreenWorkspace,
  unpinScreenSource,
  validateMousePlan
} from "./workspaceState";

const sources: ScreenSource[] = [
  { id: "screen:1:0", name: "Main Display", type: "screen" },
  { id: "window:10:0", name: "Browser", type: "window" },
  { id: "window:11:0", name: "Editor", type: "window" }
];

describe("screen workspace state", () => {
  it("pins, focuses, removes, and falls back when a source disappears", () => {
    let workspace = reconcileScreenWorkspace(createEmptyScreenWorkspace(), sources);
    workspace = pinScreenSource(workspace, sources[1].id);
    workspace = pinScreenSource(workspace, sources[2].id);
    workspace = focusScreenSource(workspace, sources[2].id);

    expect(workspace.pinnedSourceIds).toEqual([sources[1].id, sources[2].id]);
    expect(workspace.focusedSourceId).toBe(sources[2].id);

    workspace = unpinScreenSource(workspace, sources[2].id);
    expect(workspace.focusedSourceId).toBe(sources[1].id);

    workspace = reconcileScreenWorkspace(workspace, [sources[0]]);
    expect(workspace.pinnedSourceIds).toEqual([]);
    expect(workspace.focusedSourceId).toBe(sources[0].id);
  });

  it("merges observations by source id", () => {
    const workspace = reconcileScreenWorkspace(createEmptyScreenWorkspace(), sources);
    const merged = mergeScreenObservations(workspace, [
      {
        environment: "screen-share",
        screenshot: "data:image/png;base64,abc",
        viewport: { width: 100, height: 50 },
        sourceId: sources[0].id,
        sourceName: sources[0].name,
        timestamp: new Date(0).toISOString()
      }
    ]);

    expect(merged.observations[sources[0].id]?.sourceName).toBe("Main Display");
  });
});

describe("validateMousePlan", () => {
  it("validates a browser mouse plan with a proposed click action", () => {
    const plan = validateMousePlan(
      {
        x: 100,
        y: 80,
        intent: "click",
        label: "Open result",
        rationale: "The button advances the workflow.",
        risk: "medium",
        action: { type: "click", x: 100, y: 80 }
      },
      "isolated-browser",
      { width: 800, height: 600 }
    );

    expect(plan.executionMode).toBe("browser-automated");
    expect(plan.action).toEqual({ type: "click", x: 100, y: 80, button: "left" });
  });

  it("keeps screen-share mouse plans as guidance only", () => {
    const plan = validateMousePlan(
      {
        x: 200,
        y: 120,
        intent: "guide",
        label: "Click this tab",
        rationale: "This is where the user should continue."
      },
      "screen-share",
      { width: 800, height: 600 },
      "Main Display"
    );

    expect(plan.executionMode).toBe("screen-guidance");
    expect(plan.sourceName).toBe("Main Display");
  });

  it("rejects out-of-bounds coordinates", () => {
    expect(() =>
      validateMousePlan(
        { x: 900, y: 10, intent: "click", label: "Bad", rationale: "Outside viewport" },
        "screen-share",
        { width: 800, height: 600 }
      )
    ).toThrow(/outside the viewport/);
  });
});
