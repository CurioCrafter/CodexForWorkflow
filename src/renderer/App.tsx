import { useEffect, useMemo, useState } from "react";
import type { BrowserAction, BrowserPolicy, PlanStep, ScreenSource, TaskEnvironment, WorkflowPresetId } from "../shared/types";
import { LeftRail } from "./components/LeftRail";
import { RightRail } from "./components/RightRail";
import { WorkZone } from "./components/WorkZone";
import { createDemoState } from "./demoState";
import { emptyState, getActivePlanStep, getTaskControlState, presets, splitDomains } from "./lib/appModel";

const demoVariant = new URLSearchParams(window.location.search).get("demo");
const isDemoMode = demoVariant !== null;
const initialState = isDemoMode ? createDemoState(demoVariant) : emptyState;

export default function App() {
  const [state, setState] = useState(() => initialState);
  const [task, setTask] = useState(() => initialState.session?.task ?? presets[0].task);
  const [quickPrompt, setQuickPrompt] = useState("What do you see, and what should I do next?");
  const [model, setModel] = useState("gpt-5.5");
  const [environment, setEnvironment] = useState<TaskEnvironment>(() => initialState.session?.environment ?? "screen-share");
  const [workflowPreset, setWorkflowPreset] = useState<WorkflowPresetId>(() =>
    initialState.session?.environment === "isolated-browser" ? "automate-browser" : "guide-screen"
  );
  const [screenSourceId, setScreenSourceId] = useState("");
  const [allowedDomains] = useState("");
  const [blockedDomains] = useState(emptyState.policy.blockedDomains.join(", "));
  const [approvalMode] = useState(emptyState.policy.approvalMode);
  const [downloadsAllowed] = useState(false);
  const [credentialEntryAllowed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }
    window.browserPilot.getState().then(setState);
    return window.browserPilot.onState(setState);
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }
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
  const focusedObservation = focusedSource ? state.screenWorkspace.observations[focusedSource.id] : undefined;
  const stageObservation = environment === "isolated-browser" ? state.observation : focusedObservation ?? state.observation;
  const secondarySources = pinnedSources.filter((source) => source.id !== focusedSource?.id);
  const observationLabel =
    stageObservation?.environment === "screen-share"
      ? stageObservation.sourceName
      : stageObservation?.environment === "isolated-browser"
        ? stageObservation.url
        : "No live work surface";
  const activeStep = state.planSteps.length > 0 ? getActivePlanStep(state.planSteps, environment) : undefined;
  const controlState = getTaskControlState({
    busy,
    environment,
    screenSharing: state.screenSharing,
    sourceId: focusedSource?.id ?? screenSourceId,
    status: state.session?.status,
    task
  });

  async function invoke(action: () => Promise<unknown> | unknown) {
    if (isDemoMode) {
      return;
    }
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

  function sendCommand(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Follow-up command is required.");
      return;
    }
    setQuickPrompt(trimmed);
    void invoke(() => window.browserPilot.sendCommand(trimmed));
  }

  function updatePlanStep(stepId: string, status: PlanStep["status"], note?: string) {
    void invoke(() => window.browserPilot.updatePlanStep(stepId, status, note));
  }

  return (
    <main className="command-shell">
      <LeftRail
        authStatus={state.authStatus}
        environment={environment}
        workflowPreset={workflowPreset}
        presets={presets}
        sources={workspaceSources}
        focusedSourceId={focusedSource?.id}
        pinnedSourceIds={state.screenWorkspace.pinnedSourceIds}
        screenSourceId={screenSourceId}
        onCheckAuth={() => invoke(() => window.browserPilot.checkAuth())}
        onLogin={() => invoke(() => window.browserPilot.openCodexLogin())}
        onPreset={applyPreset}
        onEnvironment={setEnvironment}
        onRefreshSources={() => invoke(() => window.browserPilot.listScreenSources())}
        onStartShare={() => invoke(() => window.browserPilot.startScreenShare(screenSourceId || undefined))}
        onSelectSource={setScreenSourceId}
        onPinSource={(sourceId) => invoke(() => window.browserPilot.pinScreenSource(sourceId))}
        onUnpinSource={(sourceId) => invoke(() => window.browserPilot.unpinScreenSource(sourceId))}
        onFocusSource={(sourceId) => invoke(() => window.browserPilot.focusScreenSource(sourceId))}
      />

      <WorkZone
        busy={busy}
        controlState={controlState}
        environment={environment}
        error={error}
        model={model}
        observation={stageObservation}
        observationLabel={observationLabel}
        policy={policy}
        quickPrompt={quickPrompt}
        screenSharing={state.screenSharing}
        secondarySources={secondarySources}
        sourceObservations={state.screenWorkspace.observations}
        sessionModel={state.session?.model}
        sessionStatus={state.session?.status}
        task={task}
        activeStep={activeStep}
        mousePlan={state.mousePlan}
        onModelChange={setModel}
        onObservePinned={() => invoke(() => window.browserPilot.observePinnedSources())}
        onPause={() => invoke(() => window.browserPilot.pauseTask())}
        onResume={() => invoke(() => window.browserPilot.resumeTask())}
        onStop={() => invoke(() => (controlState.running ? window.browserPilot.stopTask() : window.browserPilot.stopScreenShare()))}
        onFocusSource={(sourceId) => invoke(() => window.browserPilot.focusScreenSource(sourceId))}
        onQuickPromptChange={setQuickPrompt}
        onSendCommand={sendCommand}
        onTaskChange={setTask}
        onStartTask={() => invoke(startTask)}
      />

      <RightRail
        environment={environment}
        planSteps={state.planSteps}
        mousePlan={state.mousePlan}
        pendingApprovals={state.pendingApprovals}
        timeline={state.timeline}
        askDisabled={controlState.askDisabled}
        askReason={controlState.askReason}
        onObserveCurrent={() => invoke(() => window.browserPilot.observeCurrent())}
        onResolveApproval={(id: string, allowed: boolean, editedAction?: BrowserAction) =>
          window.browserPilot.resolveApproval(id, allowed, editedAction)
        }
        onResolveMousePlan={(allowed) => invoke(() => window.browserPilot.resolveMousePlan(allowed))}
        onSendCommand={sendCommand}
        onUpdatePlanStep={updatePlanStep}
        onOpenDocs={() => invoke(() => window.browserPilot.openExternal("https://developers.openai.com/codex/app-server"))}
      />
    </main>
  );
}
