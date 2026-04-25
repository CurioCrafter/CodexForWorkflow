import type { AppState, ApprovalMode, PlanStep, TaskEnvironment, TaskStatus, WorkflowPresetId } from "../../shared/types";

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

  return {
    running,
    startDisabled: Boolean(startReason),
    startReason,
    pauseDisabled: !running || input.status === "paused",
    resumeDisabled: input.status !== "paused",
    stopDisabled: !running && !input.screenSharing
  };
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
