import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import type {
  AppState,
  ApprovalRequest,
  BrowserAction,
  BrowserObservation,
  BrowserPolicy,
  MousePlan,
  Observation,
  PlanStep,
  ScreenSource,
  StartTaskInput,
  TaskSession,
  TimelineEvent
} from "../../shared/types";
import { validateBrowserAction } from "./actionValidation";
import { BrowserHarness } from "./browserHarness";
import { classifyBrowserAction, DEFAULT_POLICY } from "./browserPolicy";
import {
  buildCodexTaskPrompt,
  CodexAppServerClient,
  resolveMcpServerPath
} from "./codexAppServer";
import { buildCmdStartArgs, buildCodexArgs, resolveCodexCli } from "./codexCliResolver";
import { LoopbackBridge } from "./loopbackBridge";
import { redactSensitiveText } from "./redaction";
import { ScreenShareService } from "./screenShareService";
import {
  createEmptyScreenWorkspace,
  focusScreenSource,
  mergeScreenObservations,
  normalizePlanSteps,
  pinScreenSource,
  reconcileScreenWorkspace,
  unpinScreenSource,
  updatePlanStepStatus,
  validateMousePlan
} from "./workspaceState";

interface PendingApproval {
  request: ApprovalRequest;
  resolve: (value: { allowed: boolean; action?: BrowserAction }) => void;
}

export class TaskSessionManager extends EventEmitter {
  private readonly harness: BrowserHarness;
  private readonly screenShare = new ScreenShareService();
  private readonly codex = new CodexAppServerClient();
  private bridge?: LoopbackBridge;
  private state: AppState = {
    authStatus: "Not checked",
    screenSources: [],
    screenWorkspace: createEmptyScreenWorkspace(),
    screenSharing: false,
    policy: DEFAULT_POLICY,
    planSteps: [],
    timeline: [],
    pendingApprovals: []
  };
  private pendingApprovals = new Map<string, PendingApproval>();
  private pausedResolvers: Array<() => void> = [];

  constructor(
    private readonly options: {
      appRoot: string;
      userDataPath: string;
      cwd: string;
    }
  ) {
    super();
    this.harness = new BrowserHarness({
      profileRoot: path.join(options.userDataPath, "browser-profiles")
    });

    this.codex.on("event", (event) => {
      const item = event as {
        source?: TimelineEvent["source"];
        level?: TimelineEvent["level"];
        message?: string;
        detail?: string;
      };
      this.addTimeline(item.source ?? "codex", item.level ?? "info", item.message ?? "Codex event", item.detail);
    });

    this.codex.on("notification", (message) => {
      const method = (message as { method?: string }).method ?? "";
      if (method.includes("turn/finished") || method.includes("turn/completed")) {
        this.setSessionStatus("completed");
        this.state.finalSummary = "Codex finished the browser task.";
        this.emitState();
      }
      if (method.includes("turn/failed")) {
        this.setSessionStatus("failed");
      }
    });
  }

  getState(): AppState {
    return {
      ...this.state,
      timeline: [...this.state.timeline],
      pendingApprovals: [...this.state.pendingApprovals]
    };
  }

  async checkAuth(): Promise<string> {
    const cli = resolveCodexCli();
    const status = await new Promise<string>((resolve) => {
      execFile(cli.executable, buildCodexArgs(cli, ["login", "status"]), { cwd: this.options.cwd }, (error, stdout, stderr) => {
        if (error) {
          resolve(redactSensitiveText(`${stderr || error.message}\n\n${cli.diagnostics}`));
          return;
        }
        const output = stdout.trim() || stderr.trim() || "Codex login status unavailable.";
        resolve(redactSensitiveText(`${output}\n\n${cli.diagnostics}`));
      });
    });
    this.state.authStatus = status;
    this.addTimeline("app", status.toLowerCase().includes("logged in") ? "success" : "warning", status);
    return status;
  }

  openCodexLogin(): void {
    const cli = resolveCodexCli();
    spawn("cmd.exe", buildCmdStartArgs(cli, ["login"]), {
      cwd: this.options.cwd,
      detached: true,
      stdio: "ignore"
    }).unref();
    this.addTimeline("app", "info", "Opened Codex login in a separate terminal.");
  }

  async listScreenSources(): Promise<ScreenSource[]> {
    const sources = await this.screenShare.listSources();
    this.state.screenSources = sources;
    this.state.screenWorkspace = reconcileScreenWorkspace(this.state.screenWorkspace, sources);
    this.emitState();
    return sources;
  }

  async pinScreenSource(sourceId: string): Promise<void> {
    await this.ensureScreenSources();
    this.state.screenWorkspace = pinScreenSource(this.state.screenWorkspace, sourceId);
    this.emitState();
  }

  async unpinScreenSource(sourceId: string): Promise<void> {
    this.state.screenWorkspace = unpinScreenSource(this.state.screenWorkspace, sourceId);
    this.emitState();
  }

  async focusScreenSource(sourceId: string): Promise<void> {
    await this.ensureScreenSources();
    this.state.screenWorkspace = focusScreenSource(this.state.screenWorkspace, sourceId);
    const observation = await this.screenShare.observeSource(sourceId);
    this.state.selectedScreenSource = this.state.screenWorkspace.sources.find((source) => source.id === sourceId);
    this.state.screenSharing = true;
    this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, [observation]);
    this.updateObservation(observation);
    this.addTimeline("screen", "info", `Focused ${observation.sourceName}.`);
  }

  async observePinnedSources(): Promise<void> {
    const ids = this.getActiveScreenSourceIds();
    if (ids.length === 0) {
      await this.listScreenSources();
      return;
    }
    const observations = await this.screenShare.observeSources(ids);
    this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, observations);
    const focused = observations.find((observation) => observation.sourceId === this.state.screenWorkspace.focusedSourceId) ?? observations[0];
    if (focused) {
      this.updateObservation(focused);
    }
  }

  async startScreenShare(sourceId?: string): Promise<void> {
    const observation = await this.screenShare.start(sourceId);
    this.state.selectedScreenSource = this.screenShare.getSelectedSource();
    this.state.screenSharing = true;
    const selectedId = this.state.selectedScreenSource?.id ?? observation.sourceId;
    this.state.screenWorkspace = pinScreenSource(this.state.screenWorkspace, selectedId);
    this.state.screenWorkspace = focusScreenSource(this.state.screenWorkspace, selectedId);
    this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, [observation]);
    this.updateObservation(observation);
    this.addTimeline("screen", "success", `Sharing ${observation.sourceName}.`);
    await this.listScreenSources().catch(() => undefined);
  }

  async stopScreenShare(): Promise<void> {
    const sourceName = this.state.selectedScreenSource?.name;
    this.screenShare.stop();
    this.state.screenSharing = false;
    this.state.selectedScreenSource = undefined;
    if (this.state.observation?.environment === "screen-share") {
      this.state.observation = undefined;
    }
    this.addTimeline("screen", "warning", sourceName ? `Stopped sharing ${sourceName}.` : "Stopped screen sharing.");
    this.emitState();
  }

  async startTask(input: StartTaskInput): Promise<void> {
    if (!input.task.trim()) {
      throw new Error("Task prompt is required.");
    }

    await this.stopActiveTask(false);

    const session: TaskSession = {
      id: randomUUID(),
      status: "starting",
      task: input.task.trim(),
      requestedModel: input.model.trim() || "gpt-5.5",
      model: input.model.trim() || "gpt-5.5",
      startedAt: new Date().toISOString(),
      environment: input.environment,
      approvalMode: input.policy.approvalMode
    };

    this.state = {
      ...this.state,
      session,
      policy: input.policy,
      pendingApprovals: [],
      planSteps: createInitialPlanSteps(input.environment),
      activePlanStepId: undefined,
      mousePlan: undefined,
      finalSummary: undefined
    };
    this.addTimeline(
      "app",
      "info",
      input.environment === "screen-share"
        ? "Starting observe-only screen-share session."
        : "Starting isolated browser session."
    );

    if (input.environment === "screen-share") {
      await this.ensureScreenSources();
      const sourceIds = input.screenSourceIds?.length ? input.screenSourceIds : [input.screenSourceId].filter(Boolean) as string[];
      for (const sourceId of sourceIds) {
        this.state.screenWorkspace = pinScreenSource(this.state.screenWorkspace, sourceId);
      }
      const focusId = input.screenSourceId ?? sourceIds[0] ?? this.state.screenWorkspace.focusedSourceId;
      const observation = await this.screenShare.start(focusId);
      this.state.selectedScreenSource = this.screenShare.getSelectedSource();
      this.state.screenSharing = true;
      const selectedId = this.state.selectedScreenSource?.id ?? observation.sourceId;
      this.state.screenWorkspace = pinScreenSource(this.state.screenWorkspace, selectedId);
      this.state.screenWorkspace = focusScreenSource(this.state.screenWorkspace, selectedId);
      this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, [observation]);
      await this.observePinnedSources().catch(() => undefined);
      this.updateObservation(observation);
    } else {
      const observation = await this.harness.start(session.id);
      this.updateObservation(observation);
    }

    this.bridge = new LoopbackBridge((request) => this.handleBridgeTool(request.tool, request.arguments));
    const bridgeInfo = await this.bridge.start();
    const mcpServerPath = resolveMcpServerPath(this.options.appRoot);

    await this.codex.start({
      cwd: this.options.cwd,
      mcpServerPath,
      bridgePort: bridgeInfo.port,
      bridgeToken: bridgeInfo.token
    });

    const selection = await this.codex.startTurn({
      taskPrompt: buildCodexTaskPrompt(
        input.task.trim(),
        input.environment,
        this.state.selectedScreenSource,
        this.state.screenWorkspace.sources.filter((source) => this.state.screenWorkspace.pinnedSourceIds.includes(source.id)),
        input.workflowPreset
      ),
      requestedModel: session.requestedModel,
      fallbackModel: "gpt-5.4"
    });

    session.model = selection.model;
    session.status = "running";
    this.addTimeline(
      "codex",
      selection.fellBack ? "warning" : "success",
      selection.fellBack
        ? `Using ${selection.model}; requested ${selection.requestedModel} was unavailable.`
        : `Using ${selection.model}.`
    );
    this.emitState();
  }

  async stopTask(): Promise<void> {
    await this.stopActiveTask(true);
  }

  async sendCommand(prompt: string): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new Error("Follow-up command is required.");
    }
    if (!this.state.session || ["idle", "stopped", "failed"].includes(this.state.session.status)) {
      throw new Error("Start a task before asking Codex a follow-up.");
    }
    await this.codex.sendCommand(trimmed);
    this.setSessionStatus("running");
    this.addTimeline("app", "info", `Asked Codex: ${trimmed}`);
  }

  async observeCurrent(): Promise<void> {
    if (this.state.session?.environment === "isolated-browser") {
      const observation = await this.harness.observe();
      this.updateObservation(observation);
      this.addTimeline("browser", "info", "Observed isolated browser.");
      return;
    }

    if (this.state.session?.environment === "screen-share" || this.state.screenSharing) {
      await this.observePinnedSources();
      this.addTimeline("screen", "info", "Refreshed shared screen context.");
      return;
    }

    throw new Error("Start screen sharing or a browser task before observing.");
  }

  updatePlanStepFromUser(stepId: string, status: PlanStep["status"], note?: string): void {
    const validStatuses = new Set<PlanStep["status"]>(["pending", "active", "completed", "blocked", "skipped"]);
    if (!validStatuses.has(status)) {
      throw new Error(`Unsupported plan step status: ${status}`);
    }
    const current = this.state.planSteps.find((step) => step.id === stepId);
    if (!current) {
      throw new Error(`Unknown plan step: ${stepId}`);
    }
    this.state.planSteps = applyUserPlanStepUpdate(this.state.planSteps, stepId, status, note);
    this.state.activePlanStepId = this.state.planSteps.find((step) => step.status === "active")?.id;
    const detail = note?.trim() ? note.trim() : undefined;
    this.addTimeline("app", status === "blocked" ? "warning" : "info", `Plan step ${status}: ${current.title}`, detail);
    this.emitState();
  }

  pauseTask(): void {
    this.setSessionStatus("paused");
    this.addTimeline("app", "info", "Paused browser actions.");
  }

  resumeTask(): void {
    this.setSessionStatus("running");
    this.addTimeline("app", "info", "Resumed browser actions.");
    const resolvers = this.pausedResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  }

  resolveApproval(id: string, allowed: boolean, editedAction?: BrowserAction): void {
    const pending = this.pendingApprovals.get(id);
    if (!pending) {
      return;
    }

    this.pendingApprovals.delete(id);
    this.state.pendingApprovals = this.state.pendingApprovals.filter((approval) => approval.id !== id);
    this.addTimeline("policy", allowed ? "success" : "warning", allowed ? "Approved browser action." : "Denied browser action.");
    pending.resolve({ allowed, action: editedAction ?? pending.request.action });
    this.setSessionStatus(this.state.session?.status === "awaiting-approval" ? "running" : this.state.session?.status);
    this.emitState();
  }

  private async stopActiveTask(markStopped: boolean): Promise<void> {
    await this.codex.stop().catch(() => undefined);
    await this.bridge?.stop().catch(() => undefined);
    await this.harness.stop().catch(() => undefined);
    this.screenShare.stop();
    this.bridge = undefined;
    this.state.screenSharing = false;
    this.state.selectedScreenSource = undefined;
    this.state.mousePlan = undefined;
    if (this.state.observation?.environment === "screen-share") {
      this.state.observation = undefined;
    }
    this.pendingApprovals.clear();
    this.state.pendingApprovals = [];
    this.pausedResolvers.splice(0).forEach((resolve) => resolve());
    if (markStopped) {
      this.setSessionStatus("stopped");
      this.addTimeline("app", "warning", "Stopped active task.");
    }
  }

  async handleToolForTest(tool: string, args: unknown): Promise<unknown> {
    return this.handleBridgeTool(tool, args);
  }

  private async handleBridgeTool(tool: string, args: unknown): Promise<unknown> {
    try {
      await this.waitIfPaused();

      if (tool === "screen_list_sources") {
        const sources = await this.listScreenSources();
        return { ok: true, sources, pinnedSourceIds: this.state.screenWorkspace.pinnedSourceIds };
      }

      if (tool === "screen_start") {
        const sourceId = typeof (args as { sourceId?: unknown })?.sourceId === "string"
          ? (args as { sourceId: string }).sourceId
          : undefined;
        const observation = await this.screenShare.start(sourceId);
        this.state.selectedScreenSource = this.screenShare.getSelectedSource();
        this.state.screenSharing = true;
        const selectedId = this.state.selectedScreenSource?.id ?? observation.sourceId;
        this.state.screenWorkspace = pinScreenSource(this.state.screenWorkspace, selectedId);
        this.state.screenWorkspace = focusScreenSource(this.state.screenWorkspace, selectedId);
        this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, [observation]);
        this.updateObservation(observation);
        this.addTimeline("screen", "success", `Sharing ${observation.sourceName}.`);
        return { ok: true, observation };
      }

      if (tool === "screen_observe") {
        const observation = await this.screenShare.observe();
        this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, [observation]);
        this.updateObservation(observation);
        const secondaryObservations = await this.observeSecondarySources();
        return { ok: true, observation, secondaryObservations };
      }

      if (tool === "screen_stop") {
        await this.stopScreenShare();
        return { ok: true, message: "Screen sharing stopped." };
      }

      if (tool === "screen_pin_source") {
        const sourceId = requireStringArg(args, "sourceId");
        await this.pinScreenSource(sourceId);
        return { ok: true, pinnedSourceIds: this.state.screenWorkspace.pinnedSourceIds };
      }

      if (tool === "screen_focus_source") {
        const sourceId = requireStringArg(args, "sourceId");
        await this.focusScreenSource(sourceId);
        return { ok: true, focusedSourceId: sourceId, observation: this.state.observation };
      }

      if (tool === "screen_observe_workspace") {
        await this.observePinnedSources();
        return {
          ok: true,
          focusedSourceId: this.state.screenWorkspace.focusedSourceId,
          observations: this.state.screenWorkspace.observations
        };
      }

      if (tool === "plan_board_set") {
        const steps = normalizePlanSteps((args as { steps?: unknown })?.steps);
        this.state.planSteps = steps;
        this.state.activePlanStepId = steps.find((step) => step.status === "active")?.id ?? steps[0]?.id;
        this.addTimeline("codex", "info", `Plan Board updated with ${steps.length} steps.`);
        this.emitState();
        return { ok: true, steps };
      }

      if (tool === "plan_step_update") {
        const stepId = requireStringArg(args, "stepId");
        const status = requireStringArg(args, "status") as PlanStep["status"];
        const blockedReason = typeof (args as { blockedReason?: unknown })?.blockedReason === "string"
          ? (args as { blockedReason: string }).blockedReason
          : undefined;
        this.state.planSteps = updatePlanStepStatus(this.state.planSteps, stepId, status, blockedReason);
        this.state.activePlanStepId = this.state.planSteps.find((step) => step.status === "active")?.id;
        this.emitState();
        return { ok: true, steps: this.state.planSteps };
      }

      if (tool === "mouse_plan_propose") {
        const environment = this.state.session?.environment ?? "screen-share";
        const defaultViewport = this.state.observation?.viewport ?? this.harness.getViewport();
        const sourceName =
          this.state.observation?.environment === "screen-share"
            ? this.state.observation.sourceName
            : this.state.observation?.environment === "isolated-browser"
              ? this.state.observation.title || this.state.observation.url
              : undefined;
        const mousePlan = validateMousePlan((args as { plan?: unknown })?.plan ?? args, environment, defaultViewport, sourceName);
        this.state.mousePlan = mousePlan;
        this.addTimeline("codex", mousePlan.risk === "high" ? "warning" : "info", `Mouse Plan: ${mousePlan.label}`, mousePlan.rationale);
        this.emitState();
        return {
          ok: true,
          mousePlan,
          message:
            mousePlan.executionMode === "screen-guidance"
              ? "Mouse plan rendered as observe-only guidance."
              : "Mouse plan staged for user approval."
        };
      }

      if (this.state.session?.environment === "screen-share" && tool.startsWith("browser_")) {
        return {
          ok: false,
          denied: true,
          message: "Browser action tools are unavailable in observe-only screen-share mode."
        };
      }

      if (tool === "browser_observe") {
        const observation = await this.harness.observe();
        this.updateObservation(observation);
        return { ok: true, observation };
      }

      if (tool === "browser_reset") {
        const observation = await this.harness.reset();
        this.updateObservation(observation);
        this.addTimeline("browser", "info", "Reset isolated browser.");
        return { ok: true, observation };
      }

      if (tool !== "browser_act") {
        return { ok: false, message: `Unknown browser tool: ${tool}` };
      }

      const rawAction = (args as { action?: unknown })?.action;
      const action = validateBrowserAction(rawAction, this.harness.getViewport());
      const currentObservation = await this.harness.observe();
      this.updateObservation(currentObservation);

      const decision = classifyBrowserAction(action, currentObservation, this.state.policy);
      if (!decision.allowed) {
        this.addTimeline("policy", "error", decision.riskReason ?? "Browser action blocked.");
        return { ok: false, denied: true, message: decision.riskReason ?? "Browser action blocked." };
      }

      let approvedAction = action;
      if (decision.requiresApproval) {
        const approval = await this.requestApproval(action, decision.riskReason ?? "Approval required.", currentObservation);
        if (!approval.allowed) {
          return { ok: false, denied: true, message: "Action denied by user." };
        }
        approvedAction = approval.action ?? action;
      }

      const observation = await this.harness.execute(approvedAction);
      this.updateObservation(observation);
      this.addTimeline("browser", "success", describeAction(approvedAction));
      return { ok: true, observation };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.addTimeline("browser", "error", redactSensitiveText(message));
      return { ok: false, message: redactSensitiveText(message) };
    }
  }

  private requestApproval(
    action: BrowserAction,
    riskReason: string,
    observation: BrowserObservation
  ): Promise<{ allowed: boolean; action?: BrowserAction }> {
    const request: ApprovalRequest = {
      id: randomUUID(),
      action,
      riskReason,
      screenshot: observation.screenshot,
      observation,
      createdAt: new Date().toISOString()
    };

    this.state.pendingApprovals = [...this.state.pendingApprovals, request];
    this.setSessionStatus("awaiting-approval");
    this.addTimeline("policy", "warning", riskReason);
    this.emitState();

    return new Promise((resolve) => {
      this.pendingApprovals.set(request.id, { request, resolve });
    });
  }

  private waitIfPaused(): Promise<void> {
    if (this.state.session?.status !== "paused") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.pausedResolvers.push(resolve);
    });
  }

  private updateObservation(observation: Observation): void {
    this.state.observation = observation;
    this.emitState();
  }

  private async ensureScreenSources(): Promise<void> {
    if (this.state.screenWorkspace.sources.length === 0) {
      await this.listScreenSources();
    }
  }

  private getActiveScreenSourceIds(): string[] {
    const ids = [
      this.state.screenWorkspace.focusedSourceId,
      ...this.state.screenWorkspace.pinnedSourceIds
    ].filter(Boolean) as string[];
    return [...new Set(ids)];
  }

  private async observeSecondarySources(): Promise<Observation[]> {
    const focusedId = this.state.screenWorkspace.focusedSourceId;
    const secondaryIds = this.state.screenWorkspace.pinnedSourceIds.filter((id) => id !== focusedId);
    if (secondaryIds.length === 0) {
      return [];
    }
    const observations = await this.screenShare.observeSources(secondaryIds).catch(() => []);
    this.state.screenWorkspace = mergeScreenObservations(this.state.screenWorkspace, observations);
    return observations;
  }

  async resolveMousePlan(allowed: boolean): Promise<void> {
    const mousePlan = this.state.mousePlan;
    if (!mousePlan) {
      return;
    }

    if (!allowed) {
      this.addTimeline("policy", "warning", "Mouse Plan dismissed.");
      this.state.mousePlan = undefined;
      this.emitState();
      return;
    }

    if (mousePlan.environment === "screen-share") {
      this.addTimeline("screen", "success", `Use the highlighted target: ${mousePlan.label}`);
      this.state.mousePlan = undefined;
      this.emitState();
      return;
    }

    const action = mousePlan.action ?? { type: "click", x: mousePlan.x, y: mousePlan.y, button: "left" as const };
    const observation = await this.harness.execute(action);
    this.updateObservation(observation);
    this.addTimeline("browser", "success", `Executed Mouse Plan: ${mousePlan.label}`);
    this.state.mousePlan = undefined;
    this.emitState();
  }

  private setSessionStatus(status: TaskSession["status"] | undefined): void {
    if (!status || !this.state.session) {
      return;
    }
    this.state.session = { ...this.state.session, status };
    this.emitState();
  }

  private addTimeline(
    source: TimelineEvent["source"],
    level: TimelineEvent["level"],
    message: string,
    detail?: string
  ): void {
    const event: TimelineEvent = {
      id: randomUUID(),
      source,
      level,
      message: redactSensitiveText(message),
      detail: detail ? redactSensitiveText(detail) : undefined,
      timestamp: new Date().toISOString()
    };
    this.state.timeline = [event, ...this.state.timeline].slice(0, 150);
    this.emitState();
  }

  private emitState(): void {
    this.emit("state", this.getState());
  }
}

function describeAction(action: BrowserAction): string {
  switch (action.type) {
    case "navigate":
      return `Navigated to ${action.url}`;
    case "click":
      return `Clicked at ${action.x}, ${action.y}`;
    case "type":
      return `Typed ${action.text.length} characters`;
    case "key":
      return `Pressed ${action.key}`;
    case "scroll":
      return `Scrolled ${action.deltaY}`;
    case "wait":
      return `Waited ${action.ms}ms`;
    case "screenshot":
      return "Captured screenshot";
    default:
      return "Browser action completed";
  }
}

function createInitialPlanSteps(environment: TaskSession["environment"]): PlanStep[] {
  const actionKind = environment === "screen-share" ? "guide" : "act";
  return [
    {
      id: randomUUID(),
      kind: "observe",
      title: "Read the workspace",
      detail: "Inspect the active live surface and any pinned context sources.",
      status: "active",
      confidence: 0.8,
      risk: "low"
    },
    {
      id: randomUUID(),
      kind: "decide",
      title: "Choose the next move",
      detail: "Identify the smallest useful next action before touching anything.",
      status: "pending",
      confidence: 0.7,
      risk: "low"
    },
    {
      id: randomUUID(),
      kind: actionKind,
      title: environment === "screen-share" ? "Guide the user" : "Act in the browser",
      detail:
        environment === "screen-share"
          ? "Show a visible target and explain the manual step."
          : "Use an approved browser action or Mouse Plan.",
      status: "pending",
      confidence: 0.7,
      risk: "medium"
    },
    {
      id: randomUUID(),
      kind: "verify",
      title: "Verify outcome",
      detail: "Observe again and confirm the task moved forward.",
      status: "pending",
      confidence: 0.7,
      risk: "low"
    }
  ];
}

function applyUserPlanStepUpdate(
  steps: PlanStep[],
  stepId: string,
  status: PlanStep["status"],
  note?: string
): PlanStep[] {
  const updated = updatePlanStepStatus(steps, stepId, status, note);
  if (!["completed", "skipped"].includes(status)) {
    return updated;
  }
  const hasActive = updated.some((step) => step.status === "active");
  if (hasActive) {
    return updated;
  }
  const completedIndex = updated.findIndex((step) => step.id === stepId);
  const nextPendingIndex = updated.findIndex((step, index) => index > completedIndex && step.status === "pending");
  if (nextPendingIndex < 0) {
    return updated;
  }
  return updated.map((step, index) => index === nextPendingIndex ? { ...step, status: "active" } : step);
}

function requireStringArg(args: unknown, key: string): string {
  const value = (args as Record<string, unknown> | undefined)?.[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }
  return value;
}
