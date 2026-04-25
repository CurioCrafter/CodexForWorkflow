import { describe, expect, it } from "vitest";
import type { MousePlan } from "../../shared/types";
import { getMousePlanOverlayLayout } from "./mousePlanLayout";

const basePlan: MousePlan = {
  id: "plan",
  environment: "screen-share",
  executionMode: "screen-guidance",
  viewport: { width: 1000, height: 800 },
  x: 500,
  y: 400,
  intent: "click",
  label: "Click here",
  rationale: "Next action",
  risk: "medium",
  createdAt: new Date(0).toISOString()
};

describe("getMousePlanOverlayLayout", () => {
  it("converts coordinates to percentages", () => {
    expect(getMousePlanOverlayLayout(basePlan)).toMatchObject({
      left: "50%",
      top: "50%",
      intentLabel: "CLICK"
    });
  });

  it("adds edge classes so labels can stay inside the viewport", () => {
    const layout = getMousePlanOverlayLayout({ ...basePlan, x: 990, y: 10, risk: "high", intent: "type" });

    expect(layout.className).toContain("edge-right");
    expect(layout.className).toContain("edge-top");
    expect(layout.className).toContain("high");
    expect(layout.className).toContain("intent-type");
  });
});
