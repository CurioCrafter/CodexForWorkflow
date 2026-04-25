import { Check, Eye, KeyRound, Layers3, LogIn, Monitor, MousePointer2, Pin, PinOff, RefreshCw, Shield, Target } from "lucide-react";
import type { ScreenSource, TaskEnvironment, WorkflowPresetId } from "../../shared/types";
import type { WorkflowPreset } from "../lib/appModel";

interface LeftRailProps {
  authStatus: string;
  environment: TaskEnvironment;
  workflowPreset: WorkflowPresetId;
  presets: WorkflowPreset[];
  sources: ScreenSource[];
  focusedSourceId?: string;
  pinnedSourceIds: string[];
  screenSourceId: string;
  onCheckAuth: () => void;
  onLogin: () => void;
  onPreset: (id: WorkflowPresetId) => void;
  onEnvironment: (environment: TaskEnvironment) => void;
  onRefreshSources: () => void;
  onStartShare: () => void;
  onSelectSource: (sourceId: string) => void;
  onPinSource: (sourceId: string) => void;
  onUnpinSource: (sourceId: string) => void;
  onFocusSource: (sourceId: string) => void;
}

export function LeftRail({
  authStatus,
  environment,
  workflowPreset,
  presets: workflowPresets,
  sources,
  focusedSourceId,
  pinnedSourceIds,
  screenSourceId,
  onCheckAuth,
  onLogin,
  onPreset,
  onEnvironment,
  onRefreshSources,
  onStartShare,
  onSelectSource,
  onPinSource,
  onUnpinSource,
  onFocusSource
}: LeftRailProps) {
  const authReady = authStatus.toLowerCase().includes("logged in");
  const sourceReady = sources.length > 0 && Boolean(screenSourceId || focusedSourceId);

  return (
    <aside className="left-rail">
      <header className="brand-block">
        <div className="mark">
          <Shield size={18} />
        </div>
        <div>
          <h1>CodexForWorkflow</h1>
          <p>Multi-screen guidance, browser automation, and visible intent.</p>
        </div>
      </header>

      <section className="rail-section compact">
        <div className="section-title">
          <Layers3 size={15} />
          <span>Setup checklist</span>
        </div>
        <div className="setup-list">
          <SetupItem done={authReady} label="Codex auth" detail={authReady ? "Ready" : "Check or login"} />
          <SetupItem done label="Mode" detail={environment === "screen-share" ? "Guidance only" : "Browser automation"} />
          <SetupItem
            done={sourceReady || environment === "isolated-browser"}
            label="Source"
            detail={environment === "isolated-browser" ? "Not needed for browser mode" : sourceReady ? "Screen/window selected" : "Refresh sources"}
          />
          <SetupItem done label="Task" detail="Prompt lives in the command bar" />
        </div>
      </section>

      <section className="rail-section compact">
        <div className="section-title">
          <KeyRound size={15} />
          <span>Auth</span>
          <strong className={`readiness-dot ${authReady ? "ready" : ""}`}>{authReady ? "Ready" : "Check"}</strong>
        </div>
        <p className="status-text">{authStatus}</p>
        <div className="button-row">
          <button className="secondary" onClick={onCheckAuth} title="Check Codex login status">
            <RefreshCw size={15} />
            Check
          </button>
          <button className="secondary" onClick={onLogin} title="Open Codex login in a terminal">
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
          {workflowPresets.map((preset) => (
            <button
              key={preset.id}
              className={workflowPreset === preset.id ? "active" : ""}
              onClick={() => onPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mode-switch" role="group" aria-label="Task environment">
          <button
            className={environment === "screen-share" ? "active" : ""}
            onClick={() => onEnvironment("screen-share")}
          >
            <Eye size={15} />
            Screen Share
          </button>
          <button
            className={environment === "isolated-browser" ? "active" : ""}
            onClick={() => onEnvironment("isolated-browser")}
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
          <button className="secondary" onClick={onRefreshSources} title="Refresh available screens and windows">
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className="secondary"
            disabled={!screenSourceId}
            onClick={onStartShare}
            title={screenSourceId ? "Start observe-only screen sharing" : "Refresh and select a source first"}
          >
            <Eye size={15} />
            Share
          </button>
        </div>
        <div className="source-list">
          {sources.length === 0 ? (
            <div className="empty-panel">
              <Monitor size={18} />
              <strong>No sources loaded</strong>
              <span>Refresh sources to select a screen or window.</span>
            </div>
          ) : null}
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              selected={source.id === focusedSourceId}
              pinned={pinnedSourceIds.includes(source.id)}
              onSelect={() => onSelectSource(source.id)}
              onPin={() => onPinSource(source.id)}
              onUnpin={() => onUnpinSource(source.id)}
              onFocus={() => onFocusSource(source.id)}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

function SetupItem({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className={`setup-item ${done ? "done" : ""}`}>
      <span>{done ? <Check size={13} /> : null}</span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </div>
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
      <button className="source-main" onClick={onSelect} title={`Select ${source.name}`}>
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
