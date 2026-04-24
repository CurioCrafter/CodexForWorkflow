export type TaskStatus =
  | "idle"
  | "starting"
  | "running"
  | "paused"
  | "awaiting-approval"
  | "completed"
  | "failed"
  | "stopped";

export type ApprovalMode = "step-by-step" | "confirm-risky" | "mostly-autonomous";
export type TaskEnvironment = "isolated-browser" | "screen-share";
export type WorkflowPresetId = "guide-screen" | "automate-browser" | "research-compare" | "debug-with-me";

export interface TaskSession {
  id: string;
  status: TaskStatus;
  task: string;
  model: string;
  requestedModel: string;
  startedAt: string;
  environment: TaskEnvironment;
  approvalMode: ApprovalMode;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface BrowserObservation {
  environment: "isolated-browser";
  screenshot: string;
  viewport: Viewport;
  url: string;
  title: string;
  timestamp: string;
  pageText?: string;
}

export interface ScreenSource {
  id: string;
  name: string;
  type: "screen" | "window";
  displayId?: string;
  thumbnail?: string;
}

export interface ScreenObservation {
  environment: "screen-share";
  screenshot: string;
  viewport: Viewport;
  sourceId: string;
  sourceName: string;
  timestamp: string;
}

export type Observation = BrowserObservation | ScreenObservation;

export interface ScreenWorkspace {
  sources: ScreenSource[];
  pinnedSourceIds: string[];
  focusedSourceId?: string;
  observations: Record<string, ScreenObservation>;
}

export type BrowserAction =
  | { type: "navigate"; url: string }
  | { type: "click"; x: number; y: number; button?: "left" | "right" | "middle" }
  | { type: "type"; text: string }
  | { type: "key"; key: string }
  | { type: "scroll"; deltaX?: number; deltaY: number }
  | { type: "wait"; ms: number }
  | { type: "screenshot" };

export interface BrowserPolicy {
  allowedDomains: string[];
  blockedDomains: string[];
  approvalMode: ApprovalMode;
  downloadsAllowed: boolean;
  credentialEntryAllowed: boolean;
  retentionDays: number;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  riskReason?: string;
}

export interface ApprovalRequest {
  id: string;
  action: BrowserAction;
  riskReason: string;
  screenshot?: string;
  observation?: Observation;
  createdAt: string;
}

export type PlanStepStatus = "pending" | "active" | "completed" | "blocked" | "skipped";
export type PlanStepKind = "observe" | "decide" | "act" | "guide" | "verify";
export type RiskLevel = "low" | "medium" | "high";

export interface PlanStep {
  id: string;
  kind: PlanStepKind;
  title: string;
  detail: string;
  status: PlanStepStatus;
  confidence: number;
  risk: RiskLevel;
  blockedReason?: string;
}

export type MousePlanIntent = "click" | "type" | "scroll" | "navigate" | "observe" | "guide";
export type MousePlanExecutionMode = "browser-automated" | "screen-guidance";

export interface MousePlan {
  id: string;
  environment: TaskEnvironment;
  executionMode: MousePlanExecutionMode;
  sourceId?: string;
  sourceName?: string;
  viewport: Viewport;
  x: number;
  y: number;
  intent: MousePlanIntent;
  label: string;
  rationale: string;
  risk: RiskLevel;
  action?: BrowserAction;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  level: "info" | "warning" | "error" | "success";
  source: "app" | "codex" | "browser" | "screen" | "policy" | "mcp";
  message: string;
  timestamp: string;
  detail?: string;
}

export interface AppState {
  authStatus: string;
  session?: TaskSession;
  observation?: Observation;
  screenSources: ScreenSource[];
  selectedScreenSource?: ScreenSource;
  screenWorkspace: ScreenWorkspace;
  screenSharing: boolean;
  policy: BrowserPolicy;
  planSteps: PlanStep[];
  activePlanStepId?: string;
  mousePlan?: MousePlan;
  timeline: TimelineEvent[];
  pendingApprovals: ApprovalRequest[];
  finalSummary?: string;
}

export interface StartTaskInput {
  task: string;
  model: string;
  policy: BrowserPolicy;
  environment: TaskEnvironment;
  screenSourceId?: string;
  screenSourceIds?: string[];
  workflowPreset?: WorkflowPresetId;
}

export interface ActionResult {
  ok: boolean;
  observation?: Observation;
  message?: string;
  denied?: boolean;
}
