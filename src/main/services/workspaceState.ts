import { randomUUID } from "node:crypto";
import type {
  BrowserAction,
  MousePlan,
  MousePlanIntent,
  PlanStep,
  PlanStepKind,
  RiskLevel,
  ScreenObservation,
  ScreenSource,
  ScreenWorkspace,
  TaskEnvironment,
  Viewport
} from "../../shared/types";

const VALID_PLAN_KINDS = new Set<PlanStepKind>(["observe", "decide", "act", "guide", "verify"]);
const VALID_RISKS = new Set<RiskLevel>(["low", "medium", "high"]);
const VALID_MOUSE_INTENTS = new Set<MousePlanIntent>([
  "click",
  "type",
  "scroll",
  "navigate",
  "observe",
  "guide"
]);

export function createEmptyScreenWorkspace(): ScreenWorkspace {
  return {
    sources: [],
    pinnedSourceIds: [],
    focusedSourceId: undefined,
    observations: {}
  };
}

export function reconcileScreenWorkspace(
  workspace: ScreenWorkspace,
  sources: ScreenSource[]
): ScreenWorkspace {
  const sourceIds = new Set(sources.map((source) => source.id));
  const pinnedSourceIds = workspace.pinnedSourceIds.filter((id) => sourceIds.has(id));
  const focusedSourceId =
    workspace.focusedSourceId && sourceIds.has(workspace.focusedSourceId)
      ? workspace.focusedSourceId
      : pinnedSourceIds[0] ?? sources.find((source) => source.type === "screen")?.id ?? sources[0]?.id;
  const observations = Object.fromEntries(
    Object.entries(workspace.observations).filter(([id]) => sourceIds.has(id))
  ) as Record<string, ScreenObservation>;

  return {
    sources,
    pinnedSourceIds,
    focusedSourceId,
    observations
  };
}

export function pinScreenSource(workspace: ScreenWorkspace, sourceId: string): ScreenWorkspace {
  const exists = workspace.sources.some((source) => source.id === sourceId);
  if (!exists) {
    throw new Error(`Unknown screen source: ${sourceId}`);
  }
  const pinnedSourceIds = workspace.pinnedSourceIds.includes(sourceId)
    ? workspace.pinnedSourceIds
    : [...workspace.pinnedSourceIds, sourceId].slice(0, 6);
  return {
    ...workspace,
    pinnedSourceIds,
    focusedSourceId: workspace.focusedSourceId ?? sourceId
  };
}

export function unpinScreenSource(workspace: ScreenWorkspace, sourceId: string): ScreenWorkspace {
  const pinnedSourceIds = workspace.pinnedSourceIds.filter((id) => id !== sourceId);
  return {
    ...workspace,
    pinnedSourceIds,
    focusedSourceId:
      workspace.focusedSourceId === sourceId
        ? pinnedSourceIds[0] ?? workspace.sources.find((source) => source.type === "screen")?.id ?? workspace.sources[0]?.id
        : workspace.focusedSourceId
  };
}

export function focusScreenSource(workspace: ScreenWorkspace, sourceId: string): ScreenWorkspace {
  const exists = workspace.sources.some((source) => source.id === sourceId);
  if (!exists) {
    throw new Error(`Unknown screen source: ${sourceId}`);
  }
  const pinned = pinScreenSource(workspace, sourceId);
  return { ...pinned, focusedSourceId: sourceId };
}

export function mergeScreenObservations(
  workspace: ScreenWorkspace,
  observations: ScreenObservation[]
): ScreenWorkspace {
  const merged = { ...workspace.observations };
  for (const observation of observations) {
    merged[observation.sourceId] = observation;
  }
  return { ...workspace, observations: merged };
}

export function normalizePlanSteps(rawSteps: unknown): PlanStep[] {
  const steps = Array.isArray(rawSteps) ? rawSteps : [];
  return steps.slice(0, 12).map((step, index) => {
    const record = typeof step === "object" && step ? (step as Record<string, unknown>) : {};
    const kind = typeof record.kind === "string" && VALID_PLAN_KINDS.has(record.kind as PlanStepKind)
      ? (record.kind as PlanStepKind)
      : defaultKind(index);
    const risk = typeof record.risk === "string" && VALID_RISKS.has(record.risk as RiskLevel)
      ? (record.risk as RiskLevel)
      : "low";
    const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.min(1, Math.max(0, record.confidence))
      : 0.7;
    return {
      id: typeof record.id === "string" && record.id ? record.id : randomUUID(),
      kind,
      title: typeof record.title === "string" && record.title ? record.title.slice(0, 80) : `${kind} step`,
      detail: typeof record.detail === "string" ? record.detail.slice(0, 500) : "",
      status: index === 0 ? "active" : "pending",
      confidence,
      risk,
      blockedReason: typeof record.blockedReason === "string" ? record.blockedReason.slice(0, 240) : undefined
    };
  });
}

export function updatePlanStepStatus(
  steps: PlanStep[],
  stepId: string,
  status: PlanStep["status"],
  blockedReason?: string
): PlanStep[] {
  return steps.map((step) =>
    step.id === stepId
      ? { ...step, status, blockedReason: blockedReason ?? step.blockedReason }
      : step
  );
}

export function validateMousePlan(
  rawPlan: unknown,
  environment: TaskEnvironment,
  defaultViewport: Viewport,
  sourceName?: string
): MousePlan {
  const record = typeof rawPlan === "object" && rawPlan ? (rawPlan as Record<string, unknown>) : {};
  const viewport = normalizeViewport(record.viewport, defaultViewport);
  const x = normalizeCoordinate(record.x, viewport.width, "x");
  const y = normalizeCoordinate(record.y, viewport.height, "y");
  const risk = typeof record.risk === "string" && VALID_RISKS.has(record.risk as RiskLevel)
    ? (record.risk as RiskLevel)
    : "low";
  const intent =
    typeof record.intent === "string" && VALID_MOUSE_INTENTS.has(record.intent as MousePlanIntent)
      ? (record.intent as MousePlanIntent)
      : "guide";

  return {
    id: typeof record.id === "string" && record.id ? record.id : randomUUID(),
    environment,
    executionMode: environment === "isolated-browser" ? "browser-automated" : "screen-guidance",
    sourceId: typeof record.sourceId === "string" ? record.sourceId : undefined,
    sourceName: typeof record.sourceName === "string" ? record.sourceName : sourceName,
    viewport,
    x,
    y,
    intent,
    label: typeof record.label === "string" && record.label ? record.label.slice(0, 80) : `${intent} target`,
    rationale:
      typeof record.rationale === "string" && record.rationale
        ? record.rationale.slice(0, 500)
        : "Codex proposed this mouse target as the next step.",
    risk,
    action: normalizeOptionalBrowserAction(record.action),
    createdAt: new Date().toISOString()
  };
}

function normalizeOptionalBrowserAction(action: unknown): BrowserAction | undefined {
  if (!action || typeof action !== "object") {
    return undefined;
  }
  const record = action as Record<string, unknown>;
  if (record.type === "click" && typeof record.x === "number" && typeof record.y === "number") {
    return { type: "click", x: Math.round(record.x), y: Math.round(record.y), button: "left" };
  }
  if (record.type === "type" && typeof record.text === "string") {
    return { type: "type", text: record.text };
  }
  if (record.type === "scroll" && typeof record.deltaY === "number") {
    return { type: "scroll", deltaY: Math.round(record.deltaY), deltaX: 0 };
  }
  if (record.type === "key" && typeof record.key === "string") {
    return { type: "key", key: record.key };
  }
  if (record.type === "navigate" && typeof record.url === "string") {
    return { type: "navigate", url: record.url };
  }
  return undefined;
}

function normalizeViewport(rawViewport: unknown, fallback: Viewport): Viewport {
  const record = typeof rawViewport === "object" && rawViewport ? (rawViewport as Record<string, unknown>) : {};
  const width = typeof record.width === "number" && record.width > 0 ? Math.round(record.width) : fallback.width;
  const height = typeof record.height === "number" && record.height > 0 ? Math.round(record.height) : fallback.height;
  return { width, height };
}

function normalizeCoordinate(value: unknown, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Mouse plan requires numeric ${label}.`);
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > max) {
    throw new Error(`Mouse plan ${label} is outside the viewport.`);
  }
  return rounded;
}

function defaultKind(index: number): PlanStepKind {
  return (["observe", "decide", "act", "verify"] as PlanStepKind[])[index] ?? "guide";
}
