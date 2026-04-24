import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Circle,
  Crosshair,
  ExternalLink,
  Eye,
  KeyRound,
  Layers3,
  Loader2,
  LogIn,
  Monitor,
  MousePointer2,
  Pause,
  Pin,
  PinOff,
  Play,
  RefreshCw,
  Shield,
  Square,
  Target,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AppState,
  ApprovalMode,
  ApprovalRequest,
  BrowserAction,
  BrowserPolicy,
  MousePlan,
  PlanStep,
  ScreenSource,
  TaskEnvironment,
  TimelineEvent,
  WorkflowPresetId
} from "../shared/types";

const emptyState: AppState = {
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

const presets: Array<{
  id: WorkflowPresetId;
  label: string;
  environment: TaskEnvironment;
  task: string;
}> = [
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

export default function App() {
  const [state, setState] = useState<AppState>(emptyState);
  const [task, setTask] = useState(presets[0].task);
  const [quickPrompt, setQuickPrompt] = useState("What do you see, and what should I do next?");
  const [model, setModel] = useState("gpt-5.5");
  const [environment, setEnvironment] = useState<TaskEnvironment>("screen-share");
  const [workflowPreset, setWorkflowPreset] = useState<WorkflowPresetId>("guide-screen");
  const [screenSourceId, setScreenSourceId] = useState<string>("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [blockedDomains, setBlockedDomains] = useState(emptyState.policy.blockedDomains.join(", "));
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("confirm-risky");
  const [downloadsAllowed, setDownloadsAllowed] = useState(false);
  const [credentialEntryAllowed, setCredentialEntryAllowed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.browserPilot.getState().then(setState);
    return window.browserPilot.onState(setState);
  }, []);

  useEffect(() => {
    if (environment === "screen-share" && state.screenWorkspace.sources.length === 0) {
      window.browserPilot.listScreenSources().catch(() => undefined);
    }
  }, [environment, state.screenWorkspace.sources.length]);

  useEffect(() => {
    const sources = state.screenWorkspace.sources.length > 0 ? state.screenWorkspace.sources : state.screenSources;
    if (!screenSourceId && sources.length > 0) {
      setScreenSourceId(sources.find((source) => source.type === "screen")?.id ?? sources[0].id);
    }
  }, [screenSourceId, state.screenSources, state.screenWorkspace.sources]);

  const running = ["starting", "running", "paused", "awaiting-approval"].includes(
    state.session?.status ?? "idle"
  );

  const policy: BrowserPolicy = useMemo(
    () => ({
      allowedDomains: splitDomains(allowedDomains),
      blockedDomains: splitDomains(blockedDomains),
      approvalMode,
      downloadsAllowed,
      credentialEntryAllowed,
      retentionDays: 1
    }),
    [allowedDomains, approvalMode, blockedDomains, credentialEntryAllowed, downloadsAllowed]
  );

  const workspaceSources = state.screenWorkspace.sources.length > 0 ? state.screenWorkspace.sources : state.screenSources;
  const pinnedSources = state.screenWorkspace.pinnedSourceIds
    .map((id) => workspaceSources.find((source) => source.id === id))
    .filter(Boolean) as ScreenSource[];
  const focusedSource =
    workspaceSources.find((source) => source.id === state.screenWorkspace.focusedSourceId) ??
    pinnedSources[0] ??
    workspaceSources.find((source) => source.id === screenSourceId);
  const focusedObservation =
    focusedSource ? state.screenWorkspace.observations[focusedSource.id] : undefined;
  const stageObservation = focusedObservation ?? state.observation;
  const secondarySources = pinnedSources.filter((source) => source.id !== focusedSource?.id);
  const observationLabel =
    stageObservation?.environment === "screen-share"
      ? stageObservation.sourceName
      : stageObservation?.environment === "isolated-browser"
        ? stageObservation.url
        : "No live work surface";

  async function invoke(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(id: WorkflowPresetId) {
    const preset = presets.find((item) => item.id === id)!;
    setWorkflowPreset(id);
    setEnvironment(preset.environment);
    setTask(preset.task);
  }

  async function startTask() {
    const prompt = quickPrompt.trim() ? `${task.trim()}\n\nCurrent command: ${quickPrompt.trim()}` : task;
    await window.browserPilot.startTask({
      task: prompt,
      model,
      policy,
      environment,
      screenSourceId:
        environment === "screen-share" ? (focusedSource?.id ?? (screenSourceId || undefined)) : undefined,
      screenSourceIds: environment === "screen-share" ? state.screenWorkspace.pinnedSourceIds : undefined,
      workflowPreset
    });
  }

  return (
    <main className="command-shell">
      <motion.aside
        className="left-rail"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24 }}
      >
        <header className="brand-block">
          <div className="mark">
            <Shield size={18} />
          </div>
          <div>
            <h1>Codex Command Center</h1>
            <p>Multi-screen guidance, browser automation, and visible intent.</p>
          </div>
        </header>

        <section className="rail-section compact">
          <div className="section-title">
            <KeyRound size={15} />
            <span>Auth</span>
          </div>
          <p className="status-text">{state.authStatus}</p>
          <div className="button-row">
            <button className="secondary" onClick={() => invoke(() => window.browserPilot.checkAuth())}>
              <RefreshCw size={15} />
              Check
            </button>
            <button className="secondary" onClick={() => invoke(() => window.browserPilot.openCodexLogin())}>
              <LogIn size={15} />
              Login
            </button>
          </div>
        </section>

        <section className="rail-section">
          <div className="section-title">
            <Layers3 size={15} />
            <span>Workflow</span>
          </div>
          <div className="preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                className={workflowPreset === preset.id ? "active" : ""}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mode-switch" role="group" aria-label="Task environment">
            <button
              className={environment === "screen-share" ? "active" : ""}
              onClick={() => setEnvironment("screen-share")}
            >
              <Eye size={15} />
              Screen Share
            </button>
            <button
              className={environment === "isolated-browser" ? "active" : ""}
              onClick={() => setEnvironment("isolated-browser")}
            >
              <MousePointer2 size={15} />
              Isolated Browser
            </button>
          </div>
        </section>

        <section className="rail-section grow">
          <div className="section-title">
            <Monitor size={15} />
            <span>Sources</span>
          </div>
          <div className="button-row">
            <button className="secondary" onClick={() => invoke(() => window.browserPilot.listScreenSources())}>
              <RefreshCw size={15} />
              Refresh
            </button>
            <button
              className="secondary"
              disabled={!screenSourceId}
              onClick={() => invoke(() => window.browserPilot.startScreenShare(screenSourceId || undefined))}
            >
              <Eye size={15} />
              Share
            </button>
          </div>
          <div className="source-list">
            {workspaceSources.length === 0 ? <p className="muted">No sources loaded.</p> : null}
            {workspaceSources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                selected={source.id === focusedSource?.id}
                pinned={state.screenWorkspace.pinnedSourceIds.includes(source.id)}
                onSelect={() => setScreenSourceId(source.id)}
                onPin={() => invoke(() => window.browserPilot.pinScreenSource(source.id))}
                onUnpin={() => invoke(() => window.browserPilot.unpinScreenSource(source.id))}
                onFocus={() => invoke(() => window.browserPilot.focusScreenSource(source.id))}
              />
            ))}
          </div>
        </section>
      </motion.aside>

      <section className="work-zone">
        <motion.header
          className="topbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.04 }}
        >
          <StatusPill status={state.session?.status ?? (state.screenSharing ? "sharing" : "idle")} />
          <div className="mode-readout">
            <span>{environment === "screen-share" ? "Screen Share" : "Isolated Browser"}</span>
            <strong>{state.session?.model ?? model}</strong>
          </div>
          <div className="url-readout" title={observationLabel}>
            {observationLabel}
          </div>
          <div className="toolbar">
            <button className="icon-button" title="Observe pinned sources" onClick={() => invoke(() => window.browserPilot.observePinnedSources())}>
              <RefreshCw size={16} />
            </button>
            <button
              className="icon-button"
              title="Pause"
              disabled={!running || state.session?.status === "paused"}
              onClick={() => invoke(() => window.browserPilot.pauseTask())}
            >
              <Pause size={16} />
            </button>
            <button
              className="icon-button"
              title="Resume"
              disabled={state.session?.status !== "paused"}
              onClick={() => invoke(() => window.browserPilot.resumeTask())}
            >
              <Play size={16} />
            </button>
            <button
              className="icon-button danger"
              title="Stop"
              disabled={!running && !state.screenSharing}
              onClick={() => invoke(() => running ? window.browserPilot.stopTask() : window.browserPilot.stopScreenShare())}
            >
              <Square size={14} />
            </button>
          </div>
        </motion.header>

        <motion.section
          className={`live-work-surface ${stageObservation?.environment ?? "empty"}`}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.06 }}
        >
          <div className="surface-label">
            <span>Live Work Surface</span>
            <strong>{stageObservation?.environment === "screen-share" ? "Observe-only" : "Browser control"}</strong>
          </div>
          {stageObservation?.screenshot ? (
            <>
              <img src={stageObservation.screenshot} alt="Current live work surface" />
              {state.mousePlan ? <MousePlanOverlay plan={state.mousePlan} /> : null}
            </>
          ) : (
            <div className="empty-surface">
              <Monitor size={22} />
              <span>{environment === "screen-share" ? "Pin a source and start sharing" : "Start a browser task"}</span>
            </div>
          )}
        </motion.section>

        <div className="secondary-strip">
          {secondarySources.length === 0 ? (
            <div className="strip-empty">Pin additional screens or windows for comparison context.</div>
          ) : (
            secondarySources.map((source) => {
              const observation = state.screenWorkspace.observations[source.id];
              return (
                <button
                  key={source.id}
                  className="secondary-source"
                  onClick={() => invoke(() => window.browserPilot.focusScreenSource(source.id))}
                >
                  {observation?.screenshot || source.thumbnail ? (
                    <img src={observation?.screenshot ?? source.thumbnail} alt={source.name} />
                  ) : (
                    <Monitor size={18} />
                  )}
                  <span>{source.name}</span>
                </button>
              );
            })
          )}
        </div>

        <section className="command-bar">
          <label>
            <span>Task</span>
            <textarea value={task} onChange={(event) => setTask(event.target.value)} />
          </label>
          <label className="quick-command">
            <span>Quick command</span>
            <input value={quickPrompt} onChange={(event) => setQuickPrompt(event.target.value)} />
          </label>
          <label className="model-input">
            <span>Model</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
          <button className="primary" disabled={busy || running} onClick={() => invoke(startTask)}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Start
          </button>
        </section>

        <AnimatePresence>
          {error ? (
            <motion.div
              className="error-banner"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <AlertTriangle size={16} />
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <motion.aside
        className="right-rail"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, delay: 0.08 }}
      >
        <section className="rail-section plan-board">
          <div className="section-title">
            <Target size={15} />
            <span>Plan Board</span>
          </div>
          <div className="plan-list">
            {(state.planSteps.length > 0 ? state.planSteps : fallbackPlan(environment)).map((step) => (
              <PlanStepItem key={step.id} step={step} />
            ))}
          </div>
        </section>

        <section className="rail-section mouse-plan-panel">
          <div className="section-title">
            <Crosshair size={15} />
            <span>Mouse Plan</span>
          </div>
          {state.mousePlan ? (
            <div className={`mouse-plan-card ${state.mousePlan.risk}`}>
              <strong>{state.mousePlan.label}</strong>
              <p>{state.mousePlan.rationale}</p>
              <div className="mouse-meta">
                <span>{state.mousePlan.intent}</span>
                <span>{state.mousePlan.executionMode}</span>
              </div>
              <div className="button-row">
                <button className="secondary danger" onClick={() => invoke(() => window.browserPilot.resolveMousePlan(false))}>
                  <X size={15} />
                  Dismiss
                </button>
                <button className="secondary approve" onClick={() => invoke(() => window.browserPilot.resolveMousePlan(true))}>
                  <Check size={15} />
                  {state.mousePlan.executionMode === "screen-guidance" ? "Got it" : "Execute"}
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">Codex can place a visible target before asking you to act or approving browser automation.</p>
          )}
        </section>

        <section className="rail-section approvals">
          <div className="section-title">
            <AlertTriangle size={15} />
            <span>Awaiting approval</span>
          </div>
          <AnimatePresence initial={false}>
            {state.pendingApprovals.length === 0 ? (
              <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                No pending browser actions.
              </motion.p>
            ) : (
              state.pendingApprovals.map((approval) => <ApprovalItem key={approval.id} approval={approval} />)
            )}
          </AnimatePresence>
        </section>

        <section className="rail-section timeline-section">
          <div className="section-title">
            <Circle size={15} />
            <span>Timeline</span>
          </div>
          <div className="timeline">
            {state.timeline.map((event) => <TimelineItem key={event.id} event={event} />)}
          </div>
        </section>

        <button
          className="docs-link"
          onClick={() => window.browserPilot.openExternal("https://developers.openai.com/codex/app-server")}
        >
          <ExternalLink size={15} />
          Codex app-server docs
        </button>
      </motion.aside>
    </main>
  );
}

function SourceRow({
  source,
  selected,
  pinned,
  onSelect,
  onPin,
  onUnpin,
  onFocus
}: {
  source: ScreenSource;
  selected: boolean;
  pinned: boolean;
  onSelect: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onFocus: () => void;
}) {
  return (
    <article className={`source-row ${selected ? "selected" : ""}`}>
      <button className="source-main" onClick={onSelect}>
        {source.thumbnail ? <img src={source.thumbnail} alt={source.name} /> : <Monitor size={18} />}
        <span>{source.name}</span>
      </button>
      <button className="mini-action" title="Focus source" onClick={onFocus}>
        <Target size={14} />
      </button>
      <button className="mini-action" title={pinned ? "Unpin source" : "Pin source"} onClick={pinned ? onUnpin : onPin}>
        {pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    </article>
  );
}

function MousePlanOverlay({ plan }: { plan: MousePlan }) {
  const left = `${Math.max(0, Math.min(100, (plan.x / plan.viewport.width) * 100))}%`;
  const top = `${Math.max(0, Math.min(100, (plan.y / plan.viewport.height) * 100))}%`;
  return (
    <div className={`mouse-overlay ${plan.risk}`} style={{ left, top }}>
      <span className="target-ring" />
      <span className="target-label">{plan.label}</span>
    </div>
  );
}

function PlanStepItem({ step }: { step: PlanStep }) {
  return (
    <article className={`plan-step ${step.status} ${step.risk}`}>
      <div>
        <span>{step.kind}</span>
        <strong>{step.title}</strong>
      </div>
      <p>{step.detail}</p>
      <footer>
        <span>{Math.round(step.confidence * 100)}%</span>
        <span>{step.risk}</span>
        <span>{step.status}</span>
      </footer>
    </article>
  );
}

function ApprovalItem({ approval }: { approval: ApprovalRequest }) {
  const [edited, setEdited] = useState(JSON.stringify(approval.action, null, 2));
  const [error, setError] = useState<string | undefined>();

  async function approve() {
    try {
      const parsed = JSON.parse(edited) as BrowserAction;
      await window.browserPilot.resolveApproval(approval.id, true, parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <motion.div className="approval-item" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} layout>
      <strong>{approval.riskReason}</strong>
      {approval.screenshot ? <img src={approval.screenshot} alt="Approval context screenshot" /> : null}
      <textarea value={edited} onChange={(event) => setEdited(event.target.value)} spellCheck={false} />
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="button-row">
        <button className="secondary danger" onClick={() => window.browserPilot.resolveApproval(approval.id, false)}>
          <X size={15} />
          Deny
        </button>
        <button className="secondary approve" onClick={approve}>
          <Check size={15} />
          Allow
        </button>
      </div>
    </motion.div>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  return (
    <motion.article className={`timeline-item ${event.level}`} layout>
      <div className="timeline-meta">
        <span>{event.source}</span>
        <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
      </div>
      <p>{event.message}</p>
      {event.detail ? <pre>{event.detail}</pre> : null}
    </motion.article>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <div className={`status-pill ${status}`}>
      <span />
      {status}
    </div>
  );
}

function fallbackPlan(environment: TaskEnvironment): PlanStep[] {
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

function splitDomains(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
