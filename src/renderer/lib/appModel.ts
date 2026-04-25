import type { AppState, ApprovalMode, MousePlan, PlanStep, TaskEnvironment, TaskStatus, WorkflowPresetId } from "../../shared/types";

export const emptyState: AppState = {
  authStatus: "Not checked",
  screenSources: [],
  screenWorkspace: { sources: [], pinnedSourceIds: [], observations: {} },
  screenSharing: false,
  policy: {
    allowedDomains: [],
    blockedDomains: ["bank", "paypal.com", "stripe.com", "coinbase.com", "binance.com", "robinhood.com"],
    approvalMode: "confirm-risky",
    downloadsAllowed: false,
    credentialEntryAllowed: false,
    retentionDays: 1
  },
  planSteps: [],
  timeline: [],
  pendingApprovals: []
};

export interface WorkflowPreset {
  id: WorkflowPresetId;
  label: string;
  environment: TaskEnvironment;
  task: string;
}

export const presets: WorkflowPreset[] = [
  {
    id: "guide-screen",
    label: "Guide my screen",
    environment: "screen-share",
    task: "Look across my pinned screens, plan the next steps, and guide me one action at a time."
  },
  {
    id: "automate-browser",
    label: "Automate browser",
    environment: "isolated-browser",
    task: "Use the isolated browser to complete this task, preview risky actions, and verify the result."
  },
  {
    id: "research-compare",
    label: "Research and compare",
    environment: "screen-share",
    task: "Compare the visible sources, identify differences, and give me a concise plan."
  },
  {
    id: "debug-with-me",
    label: "Debug with me",
    environment: "screen-share",
    task: "Inspect my editor, terminal, and browser context, then guide a debugging workflow."
  }
];

export function isRunningStatus(status: TaskStatus | undefined): boolean {
  return ["starting", "running", "paused", "awaiting-approval"].includes(status ?? "idle");
}

export function getTaskControlState(input: {
  status?: TaskStatus;
  screenSharing: boolean;
  busy: boolean;
  task: string;
  sourceId?: string;
  environment: TaskEnvironment;
}): {
  running: boolean;
  startDisabled: boolean;
  startReason?: string;
  askDisabled: boolean;
  askReason?: string;
  observeDisabled: boolean;
  observeReason?: string;
  mousePlanDisabled: boolean;
  mousePlanReason?: string;
  pauseDisabled: boolean;
  resumeDisabled: boolean;
  stopDisabled: boolean;
} {
  const running = isRunningStatus(input.status);
  const hasTask = input.task.trim().length > 0;
  const needsSource = input.environment === "screen-share";
  const hasSource = Boolean(input.sourceId);
  const startReason = !hasTask
    ? "Enter a task before starting."
    : needsSource && !hasSource
      ? "Refresh and select a source before screen guidance."
      : running
        ? "A task is already running."
        : input.busy
          ? "The app is finishing the current request."
          : undefined;
  const askReason = input.busy
    ? "The app is finishing the current request."
    : !running
      ? "Start a task before asking Codex a follow-up."
      : undefined;
  const observeReason = input.busy
    ? "The app is finishing the current request."
    : !running && !input.screenSharing
      ? "Start screen sharing or a browser task before observing."
      : undefined;
  const mousePlanReason = input.busy
    ? "The app is finishing the current request."
    : !running
      ? "Start a task before requesting a Mouse Plan."
      : undefined;

  return {
    running,
    startDisabled: Boolean(startReason),
    startReason,
    askDisabled: Boolean(askReason),
    askReason,
    observeDisabled: Boolean(observeReason),
    observeReason,
    mousePlanDisabled: Boolean(mousePlanReason),
    mousePlanReason,
    pauseDisabled: !running || input.status === "paused",
    resumeDisabled: input.status !== "paused",
    stopDisabled: !running && !input.screenSharing
  };
}

export function getActivePlanStep(steps: PlanStep[], environment: TaskEnvironment): PlanStep {
  const usableSteps = steps.length > 0 ? steps : fallbackPlan(environment);
  return (
    usableSteps.find((step) => step.status === "active") ??
    usableSteps.find((step) => step.status === "pending") ??
    usableSteps[usableSteps.length - 1]
  );
}

export function getStepInstruction(step: PlanStep, environment: TaskEnvironment): string {
  if (step.status === "blocked") {
    return "Resolve the blocker or ask Codex for a smaller next step.";
  }
  switch (step.kind) {
    case "observe":
      return "Refresh the visible context, then let Codex inspect what changed.";
    case "decide":
      return "Review Codex's reasoning and ask for clarification if the next step is unclear.";
    case "guide":
      return "Follow the visible guidance manually. The app will not control your desktop.";
    case "act":
      return environment === "isolated-browser"
        ? "Review the proposed browser action before allowing automation."
        : "Use manual guidance only in Screen Share mode.";
    case "verify":
      return "Observe again and confirm whether the task moved forward.";
    default:
      return "Ask Codex for the next concrete step.";
  }
}

export function getMousePlanInstruction(plan: MousePlan): string {
  if (plan.executionMode === "screen-guidance") {
    return `You perform this manually on ${plan.sourceName ?? "the shared source"}. Codex is only pointing at the target.`;
  }
  return "This can run inside the isolated browser after you approve it.";
}

export function buildFollowUpPrompt(kind: "see" | "next" | "mouse" | "verify", activeStep?: PlanStep): string {
  const context = activeStep ? ` Current Plan Board step: ${activeStep.title}.` : "";
  switch (kind) {
    case "see":
      return `What do you see right now?${context}`;
    case "next":
      return `What is the next concrete step?${context}`;
    case "mouse":
      return `Propose a Mouse Plan for the next visible target.${context}`;
    case "verify":
      return `Observe again and verify whether the last step worked.${context}`;
  }
}

export function fallbackPlan(environment: TaskEnvironment): PlanStep[] {
  return [
    {
      id: "observe",
      kind: "observe",
      title: "Observe",
      detail: "Capture the active work surface and pinned context.",
      status: "active",
      confidence: 0.8,
      risk: "low"
    },
    {
      id: "decide",
      kind: "decide",
      title: "Decide",
      detail: "Pick the next reversible step.",
      status: "pending",
      confidence: 0.7,
      risk: "low"
    },
    {
      id: "act",
      kind: environment === "screen-share" ? "guide" : "act",
      title: environment === "screen-share" ? "Guide" : "Act",
      detail: environment === "screen-share" ? "Show the user where to act." : "Execute an approved browser action.",
      status: "pending",
      confidence: 0.7,
      risk: "medium"
    },
    {
      id: "verify",
      kind: "verify",
      title: "Verify",
      detail: "Observe again and confirm progress.",
      status: "pending",
      confidence: 0.7,
      risk: "low"
    }
  ];
}

export function splitDomains(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function approvalModeLabel(mode: ApprovalMode): string {
  switch (mode) {
    case "step-by-step":
      return "Step-by-step";
    case "mostly-autonomous":
      return "Mostly autonomous";
    case "confirm-risky":
    default:
      return "Confirm risky";
  }
}
