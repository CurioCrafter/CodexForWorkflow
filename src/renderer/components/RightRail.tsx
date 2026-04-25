import { AlertTriangle, Check, Circle, Code2, Crosshair, ExternalLink, Target, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { ApprovalRequest, BrowserAction, MousePlan, PlanStep, TaskEnvironment, TimelineEvent } from "../../shared/types";
import { describeBrowserAction, parseEditedBrowserAction, summarizeApproval } from "../lib/actionSummary";
import { fallbackPlan } from "../lib/appModel";

interface RightRailProps {
  environment: TaskEnvironment;
  planSteps: PlanStep[];
  mousePlan?: MousePlan;
  pendingApprovals: ApprovalRequest[];
  timeline: TimelineEvent[];
  onResolveApproval: (id: string, allowed: boolean, editedAction?: BrowserAction) => Promise<void>;
  onResolveMousePlan: (allowed: boolean) => void;
  onOpenDocs: () => void;
}

export function RightRail({
  environment,
  planSteps,
  mousePlan,
  pendingApprovals,
  timeline,
  onResolveApproval,
  onResolveMousePlan,
  onOpenDocs
}: RightRailProps) {
  return (
    <aside className="right-rail">
      <PlanBoard steps={planSteps.length > 0 ? planSteps : fallbackPlan(environment)} />
      <MousePlanPanel plan={mousePlan} onResolve={onResolveMousePlan} />
      <ApprovalQueue approvals={pendingApprovals} onResolve={onResolveApproval} />
      <Timeline events={timeline} />
      <button className="docs-link" onClick={onOpenDocs}>
        <ExternalLink size={15} />
        Codex app-server docs
      </button>
    </aside>
  );
}

function PlanBoard({ steps }: { steps: PlanStep[] }) {
  return (
    <section className="rail-section plan-board">
      <div className="section-title">
        <Target size={15} />
        <span>Plan Board</span>
      </div>
      <div className="plan-list">
        {steps.map((step) => (
          <PlanStepItem key={step.id} step={step} />
        ))}
      </div>
    </section>
  );
}

function MousePlanPanel({ plan, onResolve }: { plan?: MousePlan; onResolve: (allowed: boolean) => void }) {
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
            <button className="secondary approve" onClick={() => onResolve(true)}>
              <Check size={15} />
              {plan.executionMode === "screen-guidance" ? "Got it" : "Execute"}
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-panel">
          <Crosshair size={18} />
          <strong>No mouse plan</strong>
          <span>Codex can preview intent before you act or before browser automation runs.</span>
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
