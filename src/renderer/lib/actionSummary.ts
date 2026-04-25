import type { ApprovalRequest, BrowserAction, BrowserObservation, Observation } from "../../shared/types";

export interface ActionSummary {
  title: string;
  detail: string;
  meta: string[];
}

export function describeBrowserAction(action: BrowserAction): ActionSummary {
  switch (action.type) {
    case "navigate":
      return {
        title: "Navigate",
        detail: action.url,
        meta: ["navigation"]
      };
    case "click":
      return {
        title: "Click target",
        detail: `${action.button ?? "left"} click at ${action.x}, ${action.y}`,
        meta: ["pointer", action.button ?? "left"]
      };
    case "type":
      return {
        title: "Type text",
        detail: `${action.text.length} characters`,
        meta: ["keyboard", "text"]
      };
    case "key":
      return {
        title: "Press key",
        detail: action.key,
        meta: ["keyboard"]
      };
    case "scroll":
      return {
        title: "Scroll",
        detail: `${action.deltaY}px vertical${action.deltaX ? `, ${action.deltaX}px horizontal` : ""}`,
        meta: ["scroll"]
      };
    case "wait":
      return {
        title: "Wait",
        detail: `${action.ms}ms`,
        meta: ["timing"]
      };
    case "screenshot":
      return {
        title: "Screenshot",
        detail: "Capture the isolated browser state.",
        meta: ["observe"]
      };
    default:
      return {
        title: "Browser action",
        detail: "Review the action payload before allowing it.",
        meta: ["browser"]
      };
  }
}

export function summarizeApproval(approval: ApprovalRequest): ActionSummary {
  const action = describeBrowserAction(approval.action);
  const context = describeObservationContext(approval.observation);
  return {
    title: action.title,
    detail: context ? `${action.detail} on ${context}` : action.detail,
    meta: [...action.meta, riskMeta(approval.riskReason)]
  };
}

export function parseEditedBrowserAction(value: string): BrowserAction {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Edited action must be a JSON object.");
  }
  const action = parsed as BrowserAction;
  if (!("type" in action) || typeof action.type !== "string") {
    throw new Error("Edited action requires a type.");
  }
  return action;
}

function describeObservationContext(observation: Observation | undefined): string | undefined {
  if (!observation) {
    return undefined;
  }
  if (observation.environment === "screen-share") {
    return observation.sourceName;
  }
  return describeBrowserContext(observation);
}

function describeBrowserContext(observation: BrowserObservation): string {
  try {
    const url = new URL(observation.url);
    return url.hostname || observation.title || observation.url;
  } catch {
    return observation.title || observation.url;
  }
}

function riskMeta(reason: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes("credential")) {
    return "credentials";
  }
  if (normalized.includes("download")) {
    return "download";
  }
  if (normalized.includes("send") || normalized.includes("external")) {
    return "external";
  }
  return "approval";
}
