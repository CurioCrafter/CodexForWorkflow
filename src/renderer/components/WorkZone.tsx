import { AlertTriangle, Loader2, Monitor, MousePointer2, Pause, Play, RefreshCw, Square } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  BrowserPolicy,
  MousePlan,
  Observation,
  ScreenSource,
  TaskEnvironment,
  TaskStatus
} from "../../shared/types";
import { getMousePlanOverlayLayout } from "../lib/mousePlanLayout";

interface WorkZoneProps {
  busy: boolean;
  controlState: {
    running: boolean;
    startDisabled: boolean;
    startReason?: string;
    pauseDisabled: boolean;
    resumeDisabled: boolean;
    stopDisabled: boolean;
  };
  environment: TaskEnvironment;
  error?: string;
  model: string;
  observation?: Observation;
  observationLabel: string;
  policy: BrowserPolicy;
  quickPrompt: string;
  screenSharing: boolean;
  secondarySources: ScreenSource[];
  sourceObservations: Record<string, Observation | undefined>;
  sessionModel?: string;
  sessionStatus?: TaskStatus;
  task: string;
  mousePlan?: MousePlan;
  onModelChange: (value: string) => void;
  onObservePinned: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onFocusSource: (sourceId: string) => void;
  onQuickPromptChange: (value: string) => void;
  onTaskChange: (value: string) => void;
  onStartTask: () => void;
}

export function WorkZone({
  busy,
  controlState,
  environment,
  error,
  model,
  observation,
  observationLabel,
  quickPrompt,
  screenSharing,
  secondarySources,
  sourceObservations,
  sessionModel,
  sessionStatus,
  task,
  mousePlan,
  onModelChange,
  onObservePinned,
  onPause,
  onResume,
  onStop,
  onFocusSource,
  onQuickPromptChange,
  onTaskChange,
  onStartTask
}: WorkZoneProps) {
  return (
    <section className="work-zone">
      <motion.header
        className="topbar"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
      >
        <StatusPill status={sessionStatus ?? (screenSharing ? "sharing" : "idle")} />
        <div className="mode-readout">
          <span>{environment === "screen-share" ? "Screen Share" : "Isolated Browser"}</span>
          <strong>{sessionModel ?? model}</strong>
        </div>
        <div className="url-readout" title={observationLabel}>
          {observationLabel}
        </div>
        <div className="toolbar">
          <button className="icon-button" title="Observe pinned sources" onClick={onObservePinned}>
            <RefreshCw size={16} />
          </button>
          <button className="icon-button" title="Pause" disabled={controlState.pauseDisabled} onClick={onPause}>
            <Pause size={16} />
          </button>
          <button className="icon-button" title="Resume" disabled={controlState.resumeDisabled} onClick={onResume}>
            <Play size={16} />
          </button>
          <button className="icon-button danger" title="Stop" disabled={controlState.stopDisabled} onClick={onStop}>
            <Square size={14} />
          </button>
        </div>
      </motion.header>

      <LiveWorkSurface environment={environment} observation={observation} mousePlan={mousePlan} />

      <div className="secondary-strip">
        {secondarySources.length === 0 ? (
          <div className="strip-empty">Pin additional screens or windows for comparison context.</div>
        ) : (
          secondarySources.map((source) => {
            const sourceObservation = sourceObservations[source.id];
            return (
              <button key={source.id} className="secondary-source" onClick={() => onFocusSource(source.id)}>
                {sourceObservation?.screenshot || source.thumbnail ? (
                  <img src={sourceObservation?.screenshot ?? source.thumbnail} alt={source.name} />
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
          <textarea value={task} onChange={(event) => onTaskChange(event.target.value)} />
        </label>
        <label className="quick-command">
          <span>Quick command</span>
          <input value={quickPrompt} onChange={(event) => onQuickPromptChange(event.target.value)} />
        </label>
        <label className="model-input">
          <span>Model</span>
          <input value={model} onChange={(event) => onModelChange(event.target.value)} />
        </label>
        <button
          className="primary"
          disabled={controlState.startDisabled}
          onClick={onStartTask}
          title={controlState.startReason ?? "Start task"}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
          Start
        </button>
      </section>

      <AnimatePresence>
        {controlState.startReason && !controlState.running ? (
          <motion.p className="helper-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {controlState.startReason}
          </motion.p>
        ) : null}
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
  );
}

function LiveWorkSurface({
  environment,
  observation,
  mousePlan
}: {
  environment: TaskEnvironment;
  observation?: Observation;
  mousePlan?: MousePlan;
}) {
  return (
    <motion.section
      className={`live-work-surface ${observation?.environment ?? "empty"}`}
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: 0.06 }}
    >
      <div className="surface-label">
        <span>Live Work Surface</span>
        <strong>{observation?.environment === "screen-share" ? "Observe-only" : "Browser control"}</strong>
      </div>
      {observation?.screenshot ? (
        <>
          <img src={observation.screenshot} alt="Current live work surface" />
          {mousePlan ? <MousePlanOverlay plan={mousePlan} /> : null}
        </>
      ) : (
        <div className="empty-surface">
          <Monitor size={24} />
          <strong>{environment === "screen-share" ? "Choose a source to guide" : "Start an isolated browser task"}</strong>
          <span>
            {environment === "screen-share"
              ? "Screen Share is observe-only. Codex can point and explain, but it cannot click your desktop."
              : "Browser automation runs in an isolated Playwright profile with approvals for risky actions."}
          </span>
        </div>
      )}
    </motion.section>
  );
}

function MousePlanOverlay({ plan }: { plan: MousePlan }) {
  const layout = getMousePlanOverlayLayout(plan);
  return (
    <div className={layout.className} style={{ left: layout.left, top: layout.top }}>
      <span className="target-ring" />
      <span className="intent-chip">
        <MousePointer2 size={12} />
        {layout.intentLabel}
      </span>
      <span className="target-label">{plan.label}</span>
      {plan.sourceName ? <span className="target-source">{plan.sourceName}</span> : null}
    </div>
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
