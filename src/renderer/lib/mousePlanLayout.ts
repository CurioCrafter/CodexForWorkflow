import type { MousePlan } from "../../shared/types";

export interface MousePlanOverlayLayout {
  left: string;
  top: string;
  className: string;
  intentLabel: string;
}

export function getMousePlanOverlayLayout(plan: MousePlan): MousePlanOverlayLayout {
  const xPercent = clampPercent((plan.x / plan.viewport.width) * 100);
  const yPercent = clampPercent((plan.y / plan.viewport.height) * 100);
  const edgeClass = [
    xPercent < 18 ? "edge-left" : "",
    xPercent > 82 ? "edge-right" : "",
    yPercent < 18 ? "edge-top" : "",
    yPercent > 82 ? "edge-bottom" : ""
  ].filter(Boolean).join(" ");

  return {
    left: `${xPercent}%`,
    top: `${yPercent}%`,
    className: ["mouse-overlay", plan.risk, `intent-${plan.intent}`, edgeClass].filter(Boolean).join(" "),
    intentLabel: plan.intent.replace("-", " ").toUpperCase()
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.max(2, Math.min(98, Math.round(value * 100) / 100));
}
