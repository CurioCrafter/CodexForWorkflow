import { AlertTriangle, Check, Circle, Code2, Crosshair, ExternalLink, HelpCircle, ListChecks, RefreshCw, Target, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { ApprovalRequest, BrowserAction, MousePlan, PlanStep, TaskEnvironment, TimelineEvent } from "../../shared/types";
import { describeBrowserAction, parseEditedBrowserAction, summarizeApproval } from "../lib/actionSummary";
import { buildFollowUpPrompt, fallbackPlan, getActivePlanStep, getMousePlanInstruction, getStepInstruction } from "../lib/appModel";

interface RightRailProps {
  environment: TaskEnvironment;
  planSteps: PlanStep[];
  mousePlan?: MousePlan;
  pendingApprovals: ApprovalRequest[];
  timeline: TimelineEvent[];
  askDisabled: boolean;
  askReason?: string;
  onObserveCurrent: () => void;
  onResolveApproval: (id: string, allowed: boolean, editedAction?: BrowserAction) => Promise<void>;
  onResolveMousePlan: (allowed: boolean) => void;
  onSendCommand: (prompt: string) => void;
  onUpdatePlanStep: (stepId: string, status: PlanStep["status"], note?: string) => void;
  onOpenDocs: () => void;
}

export function RightRail({
  environment,
  planSteps,
  mousePlan,
  pendingApprovals,
  timeline,
  askDisabled,
  askReason,
  onObserveCurrent,
  onResolveApproval,
  onResolveMousePlan,
  onSendCommand,
  onUpdatePlanStep,
  onOpenDocs
}: RightRailProps) {
  const [tab, setTab] = useState<"guide" | "approvals" | "activity" | "details">(() =>
    pendingApprovals.length > 0 ? "approvals" : "guide"
  );
  const hasPlan = planSteps.length > 0;
  const steps = planSteps.length > 0 ? planSteps : fallbackPlan(environment);
  const activeStep = getActivePlanStep(steps, environment);

  return (
    <aside className="right-rail">
      <nav className="guide-tabs" aria-label="Guidance panels">
        <button className={tab === "guide" ? "active" : ""} onClick={() => setTab("guide")}>Guide</button>
        <button className={tab === "approvals" ? "active" : ""} onClick={() => setTab("approvals")}>Approvals{pendingApprovals.length ? ` ${pendingApprovals.length}` : ""}</button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>Activity</button>
        <button className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}>Details</button>
      </nav>

      {tab === "guide" ? (
        <>
          <GuidePanel
            environment={environment}
            hasPlan={hasPlan}
            steps={steps}
            activeStep={activeStep}
            mousePlan={mousePlan}
            onObserveCurrent={onObserveCurrent}
            onResolveMousePlan={onResolveMousePlan}
            onSendCommand={onSendCommand}
            onUpdatePlanStep={onUpdatePlanStep}
            askDisabled={askDisabled}
            askReason={askReason}
          />
        </>
      ) : null}

      {tab === "approvals" ? <ApprovalQueue approvals={pendingApprovals} onResolve={onResolveApproval} /> : null}
      {tab === "activity" ? <Timeline events={timeline} /> : null}
      {tab === "details" ? <DetailsPanel environment={environment} onOpenDocs={onOpenDocs} /> : null}

      <button className="docs-link" onClick={onOpenDocs}>
        <ExternalLink size={15} />
        Codex app-server docs
      </button>
    </aside>
  );
}

function GuidePanel({
  environment,
  hasPlan,
  steps,
  activeStep,
  mousePlan,
  onObserveCurrent,
  onResolveMousePlan,
  onSendCommand,
  onUpdatePlanStep,
  askDisabled,
  askReason
}: {
  environment: TaskEnvironment;
  hasPlan: boolean;
  steps: PlanStep[];
  activeStep: PlanStep;
  mousePlan?: MousePlan;
  onObserveCurrent: () => void;
  onResolveMousePlan: (allowed: boolean) => void;
  onSendCommand: (prompt: string) => void;
  onUpdatePlanStep: (stepId: string, status: PlanStep["status"], note?: string) => void;
  askDisabled: boolean;
  askReason?: string;
}) {
  return (
    <div className="guide-panel">
      {hasPlan ? (
        <ActiveStepCard
          step={activeStep}
          environment={environment}
          onObserveCurrent={onObserveCurrent}
          onSendCommand={onSendCommand}
          onUpdatePlanStep={onUpdatePlanStep}
          askDisabled={askDisabled}
          askReason={askReason}
        />
      ) : (
        <EmptyGuideCard environment={environment} />
      )}
      <MousePlanPanel
        plan={mousePlan}
        environment={environment}
        activeStep={activeStep}
        onResolve={onResolveMousePlan}
        onSendCommand={onSendCommand}
        askDisabled={askDisabled}
        askReason={askReason}
      />
      <PlanBoard
        environment={environment}
        hasPlan={hasPlan}
        steps={steps}
        onObserveCurrent={onObserveCurrent}
        onSendCommand={onSendCommand}
        onUpdatePlanStep={onUpdatePlanStep}
        askDisabled={askDisabled}
        askReason={askReason}
      />
    </div>
  );
}

function EmptyGuideCard({ environment }: { environment: TaskEnvironment }) {
  return (
    <section className="active-guide-card empty-guide">
      <div className="section-title">
        <ListChecks size={15} />
        <span>Current step</span>
      </div>
      <strong>Guidance starts after setup</strong>
      <p>
        {environment === "screen-share"
          ? "Choose a screen or window, then start a task. Codex will observe, decide, guide, and verify one step at a time."
          : "Start an isolated browser task. Codex will plan actions, request approvals when needed, and verify results."}
      </p>
    </section>
  );
}

function ActiveStepCard({
  step,
  environment,
  onObserveCurrent,
  onSendCommand,
  onUpdatePlanStep,
  askDisabled,
  askReason
}: {
  step: PlanStep;
  environment: TaskEnvironment;
  onObserveCurrent: () => void;
  onSendCommand: (prompt: string) => void;
  onUpdatePlanStep: (stepId: string, status: PlanStep["status"], note?: string) => void;
  askDisabled: boolean;
  askReason?: string;
}) {
  return (
    <section className={`active-guide-card ${step.risk}`}>
      <div className="section-title">
        <ListChecks size={15} />
        <span>Current step</span>
      </div>
      <strong>{step.title}</strong>
      <p>{step.detail || getStepInstruction(step, environment)}</p>
      <div className="step-insight">
        <span>{Math.round(step.confidence * 100)}% confidence</span>
        <span>{step.risk} risk</span>
        <span>{step.status}</span>
      </div>
      <p className="step-next-action">{getStepInstruction(step, environment)}</p>
      <div className="guide-action-grid">
        <button className="secondary" disabled={askDisabled} title={askReason} onClick={() => onSendCommand(buildFollowUpPrompt("next", step))}>
          <HelpCircle size={14} />
          Ask Codex
        </button>
        <button className="secondary approve" onClick={() => onUpdatePlanStep(step.id, "completed")}>
          <Check size={14} />
          Mark done
        </button>
        <button className="secondary" onClick={() => onObserveCurrent()}>
          <RefreshCw size={14} />
          Observe now
        </button>
        <button className="secondary danger" onClick={() => onUpdatePlanStep(step.id, "blocked", "User marked this step blocked.")}>
          <X size={14} />
          Blocked
        </button>
      </div>
    </section>
  );
}

function PlanBoard({
  environment,
  hasPlan,
  steps,
  onObserveCurrent,
  onSendCommand,
  onUpdatePlanStep,
  askDisabled,
  askReason
}: {
  environment: TaskEnvironment;
  hasPlan: boolean;
  steps: PlanStep[];
  onObserveCurrent: () => void;
  onSendCommand: (prompt: string) => void;
  onUpdatePlanStep: (stepId: string, status: PlanStep["status"], note?: string) => void;
  askDisabled: boolean;
  askReason?: string;
}) {
  const [expandedStepId, setExpandedStepId] = useState<string | undefined>();

  return (
    <section className="rail-section plan-board">
      <div className="section-title">
        <Target size={15} />
        <span>Plan Board</span>
      </div>
      {!hasPlan ? (
        <div className="empty-plan-flow">
          <strong>No task plan yet</strong>
          <p>Start a task and Codex will keep one active step visible: observe the workspace, decide on the safest move, guide or act, then verify the result.</p>
        </div>
      ) : null}
      {hasPlan ? (
        <div className="plan-list">
          {steps.map((step) => (
            <PlanStepItem
              key={step.id}
              step={step}
              environment={environment}
              expanded={expandedStepId === step.id}
              onToggle={() => setExpandedStepId(expandedStepId === step.id ? undefined : step.id)}
              onObserveCurrent={onObserveCurrent}
              onSendCommand={onSendCommand}
              onUpdatePlanStep={onUpdatePlanStep}
              askDisabled={askDisabled}
              askReason={askReason}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MousePlanPanel({
  plan,
  environment,
  activeStep,
  onResolve,
  onSendCommand,
  askDisabled,
  askReason
}: {
  plan?: MousePlan;
  environment: TaskEnvironment;
  activeStep: PlanStep;
  onResolve: (allowed: boolean) => void;
  onSendCommand: (prompt: string) => void;
  askDisabled: boolean;
  askReason?: string;
}) {
  return (
    <section className="rail-section mouse-plan-panel">
      <div className="section-title">
        <Crosshair size={15} />
        <span>Mouse Plan</span>
      </div>
      {plan ? (
        <div className={`mouse-plan-card ${plan.risk}`}>
          <strong>{plan.label}</strong>
          <p>{plan.rationale}</p>
          <p className="step-next-action">{getMousePlanInstruction(plan)}</p>
          <div className="mouse-meta">
            <span>{plan.intent}</span>
            <span>{plan.executionMode}</span>
            {plan.sourceName ? <span>{plan.sourceName}</span> : null}
          </div>
          <div className="button-row">
            <button className="secondary danger" onClick={() => onResolve(false)}>
              <X size={15} />
              Dismiss
            </button>
            {environment === "screen-share" ? (
              <button
                className="secondary"
                disabled={askDisabled}
                title={askReason}
                onClick={() => onSendCommand("Adjust the Mouse Plan target and explain why the new target is better.")}
              >
                <Crosshair size={15} />
                Adjust
              </button>
            ) : null}
            <button
              className="secondary approve"
              onClick={() => {
                onResolve(true);
                if (plan.executionMode === "screen-guidance") {
                  onSendCommand(buildFollowUpPrompt("verify", activeStep));
                }
              }}
            >
              <Check size={15} />
              {plan.executionMode === "screen-guidance" ? "I did this" : "Execute"}
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-panel">
          <Crosshair size={18} />
          <strong>No mouse plan</strong>
          <span>Codex can preview intent before you act or before browser automation runs.</span>
          <button className="secondary" disabled={askDisabled} title={askReason} onClick={() => onSendCommand(buildFollowUpPrompt("mouse", activeStep))}>
            <Crosshair size={14} />
            Request Mouse Plan
          </button>
        </div>
      )}
    </section>
  );
}

function ApprovalQueue({
  approvals,
  onResolve
}: {
  approvals: ApprovalRequest[];
  onResolve: (id: string, allowed: boolean, editedAction?: BrowserAction) => Promise<void>;
}) {
  return (
    <section className="rail-section approvals">
      <div className="section-title">
        <AlertTriangle size={15} />
        <span>Awaiting approval</span>
        {approvals.length > 0 ? <strong className="queue-count">{approvals.length}</strong> : null}
      </div>
      <AnimatePresence initial={false}>
        {approvals.length === 0 ? (
          <motion.div className="empty-panel compact-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Check size={17} />
            <strong>No pending browser actions</strong>
            <span>Risky isolated-browser actions will pause here before execution.</span>
          </motion.div>
        ) : (
          approvals.map((approval) => <ApprovalItem key={approval.id} approval={approval} onResolve={onResolve} />)
        )}
      </AnimatePresence>
    </section>
  );
}

function ApprovalItem({
  approval,
  onResolve
}: {
  approval: ApprovalRequest;
  onResolve: (id: string, allowed: boolean, editedAction?: BrowserAction) => Promise<void>;
}) {
  const [edited, setEdited] = useState(JSON.stringify(approval.action, null, 2));
  const [error, setError] = useState<string | undefined>();
  const action = summarizeApproval(approval);
  const rawAction = describeBrowserAction(approval.action);

  async function approve() {
    try {
      const parsed = parseEditedBrowserAction(edited);
      setError(undefined);
      await onResolve(approval.id, true, parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <motion.div className="approval-item" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} layout>
      <div className="approval-summary">
        <strong>{action.title}</strong>
        <p>{action.detail}</p>
        <div className="mouse-meta">
          {action.meta.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <p className="approval-risk">{approval.riskReason}</p>
      {approval.screenshot ? <img src={approval.screenshot} alt="Approval context screenshot" /> : null}
      <details className="advanced-action">
        <summary>
          <Code2 size={14} />
          Edit action JSON
        </summary>
        <textarea value={edited} onChange={(event) => setEdited(event.target.value)} spellCheck={false} />
        <p className="muted">Original action: {rawAction.detail}</p>
      </details>
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="button-row approval-actions">
        <button className="secondary danger" onClick={() => onResolve(approval.id, false)}>
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

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rail-section timeline-section">
      <div className="section-title">
        <Circle size={15} />
        <span>Timeline</span>
      </div>
      <div className="timeline">
        {events.length === 0 ? (
          <div className="empty-panel compact-empty">
            <Circle size={17} />
            <strong>No activity yet</strong>
            <span>Codex narration, policy decisions, and browser events appear here.</span>
          </div>
        ) : (
          events.map((event) => <TimelineItem key={event.id} event={event} />)
        )}
      </div>
    </section>
  );
}

function PlanStepItem({
  step,
  environment,
  expanded,
  onToggle,
  onObserveCurrent,
  onSendCommand,
  onUpdatePlanStep,
  askDisabled,
  askReason
}: {
  step: PlanStep;
  environment: TaskEnvironment;
  expanded: boolean;
  onToggle: () => void;
  onObserveCurrent: () => void;
  onSendCommand: (prompt: string) => void;
  onUpdatePlanStep: (stepId: string, status: PlanStep["status"], note?: string) => void;
  askDisabled: boolean;
  askReason?: string;
}) {
  return (
    <article className={`plan-step ${step.status} ${step.risk} ${expanded ? "expanded" : ""}`}>
      <button className="plan-step-toggle" onClick={onToggle}>
        <div>
          <span>{step.kind}</span>
          <strong>{step.title}</strong>
        </div>
        <footer>
          <span>{Math.round(step.confidence * 100)}%</span>
          <span>{step.risk}</span>
          <span>{step.status}</span>
        </footer>
      </button>
      {expanded ? (
        <div className="plan-step-detail">
          <p>{step.detail}</p>
          <p className="step-next-action">{getStepInstruction(step, environment)}</p>
          {step.blockedReason ? <p className="inline-error">{step.blockedReason}</p> : null}
          <div className="guide-action-grid">
            <button className="secondary" disabled={askDisabled} title={askReason} onClick={() => onSendCommand(buildFollowUpPrompt("next", step))}>Ask</button>
            <button className="secondary approve" onClick={() => onUpdatePlanStep(step.id, "completed")}>Done</button>
            <button className="secondary" onClick={() => onUpdatePlanStep(step.id, "skipped")}>Skip</button>
            <button className="secondary" onClick={onObserveCurrent}>Observe</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DetailsPanel({ environment, onOpenDocs }: { environment: TaskEnvironment; onOpenDocs: () => void }) {
  return (
    <section className="rail-section details-panel">
      <div className="section-title">
        <Code2 size={15} />
        <span>Details</span>
      </div>
      <div className="empty-panel">
        <strong>{environment === "screen-share" ? "Screen Share safety" : "Isolated Browser safety"}</strong>
        <span>
          {environment === "screen-share"
            ? "Desktop sharing is observe-only. Codex can inspect screenshots and guide you, but it cannot click or type."
            : "Browser automation runs only inside the isolated Playwright profile and sensitive actions require approval."}
        </span>
        <button className="secondary" onClick={onOpenDocs}>
          <ExternalLink size={14} />
          Integration docs
        </button>
      </div>
    </section>
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
