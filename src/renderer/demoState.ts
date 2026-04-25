import type { AppState, BrowserObservation, BrowserPolicy, PlanStep, ScreenObservation, ScreenSource, TaskSession } from "../shared/types";

const sources: ScreenSource[] = [
  { id: "screen:demo-main:0", name: "Main Display - Debug Workspace", type: "screen" },
  { id: "window:demo-editor:0", name: "Editor - Agent Runtime", type: "window" },
  { id: "window:demo-browser:0", name: "Browser - Codex Docs", type: "window" }
];

const planSteps: PlanStep[] = [
  {
    id: "observe",
    kind: "observe",
    title: "Read visible context",
    detail: "Inspect the main display and pinned references before recommending the next step.",
    status: "completed",
    confidence: 0.94,
    risk: "low"
  },
  {
    id: "decide",
    kind: "decide",
    title: "Choose next action",
    detail: "Use the source with the clearest evidence and avoid touching private desktop controls.",
    status: "active",
    confidence: 0.86,
    risk: "low"
  },
  {
    id: "guide",
    kind: "guide",
    title: "Guide the user",
    detail: "Show a visible target and explain the manual step in plain language.",
    status: "pending",
    confidence: 0.78,
    risk: "medium"
  },
  {
    id: "verify",
    kind: "verify",
    title: "Verify progress",
    detail: "Observe again and confirm that the workflow moved forward.",
    status: "pending",
    confidence: 0.74,
    risk: "low"
  }
];

const demoPolicy: BrowserPolicy = {
  allowedDomains: [],
  blockedDomains: ["bank", "paypal.com", "stripe.com"],
  approvalMode: "confirm-risky",
  downloadsAllowed: false,
  credentialEntryAllowed: false,
  retentionDays: 1
};

export function createDemoState(variant: string | null): AppState {
  const demoVariant = variant ?? "mouse-plan";
  if (demoVariant === "first-run") {
    return {
      authStatus: "Not checked",
      screenSources: [],
      screenWorkspace: { sources: [], pinnedSourceIds: [], observations: {} },
      screenSharing: false,
      policy: demoPolicy,
      planSteps: [],
      pendingApprovals: [],
      timeline: [],
      finalSummary: undefined
    };
  }

  const observations = Object.fromEntries(
    sources.map((source, index) => [
      source.id,
      createObservation(source, index === 0 ? "Debug Command Center" : index === 1 ? "Runtime Notes" : "Docs Reference", index)
    ])
  ) as Record<string, ScreenObservation>;
  const isApproval = demoVariant === "approval";
  const showMousePlan = ["overview", "mouse-plan", "approval"].includes(demoVariant);
  const environment = isApproval ? "isolated-browser" : "screen-share";
  const browserObservation = createBrowserObservation();
  const observation = isApproval ? browserObservation : observations[sources[0].id];
  const session: TaskSession = {
    id: "demo-session",
    status: isApproval ? "awaiting-approval" : "running",
    task: isApproval
      ? "Review this isolated-browser action and require approval before it runs."
      : "Guide this workflow one safe step at a time.",
    model: "gpt-5.5",
    requestedModel: "gpt-5.5",
    startedAt: new Date(0).toISOString(),
    environment,
    approvalMode: "confirm-risky"
  };

  return {
    authStatus: "Logged in using ChatGPT\nCodex CLI=demo\nNode=demo",
    session,
    screenSources: sources,
    selectedScreenSource: sources[0],
    screenWorkspace: {
      sources: sources.map((source, index) => ({
        ...source,
        thumbnail: createMiniScreenshot(source.name, index)
      })),
      pinnedSourceIds: sources.map((source) => source.id),
      focusedSourceId: sources[0].id,
      observations
    },
    screenSharing: !isApproval,
    observation,
    policy: demoPolicy,
    planSteps: isApproval ? approvalPlanSteps() : planSteps,
    activePlanStepId: isApproval ? "approval-act" : "decide",
    mousePlan: showMousePlan
      ? {
          id: "mouse-demo",
          environment,
          executionMode: isApproval ? "browser-automated" : "screen-guidance",
          sourceId: isApproval ? undefined : sources[0].id,
          sourceName: isApproval ? "Isolated browser" : sources[0].name,
          viewport: { width: 1440, height: 900 },
          x: isApproval ? 980 : 1040,
          y: isApproval ? 520 : 410,
          intent: isApproval ? "click" : "guide",
          label: isApproval ? "Review before send" : "Next best step",
          rationale: isApproval
            ? "This action could send information externally, so the user should approve it first."
            : "This target advances the workflow while keeping desktop control in the user's hands.",
          risk: isApproval ? "high" : "medium",
          action: isApproval ? { type: "click", x: 980, y: 520, button: "left" } : undefined,
          createdAt: new Date(0).toISOString()
        }
      : undefined,
    pendingApprovals:
      isApproval
        ? [
            {
              id: "approval-demo",
              action: { type: "click", x: 980, y: 520, button: "left" },
              riskReason: "External send-like action requires approval.",
              screenshot: browserObservation.screenshot,
              observation: browserObservation,
              createdAt: new Date(0).toISOString()
            }
          ]
        : [],
    timeline: [
      {
        id: "timeline-1",
        source: "codex",
        level: "info",
        message: "Plan Board updated with observe, decide, guide, and verify steps.",
        timestamp: new Date(0).toISOString()
      },
      {
        id: "timeline-2",
        source: "screen",
        level: "success",
        message: "Sharing Main Display - Debug Workspace.",
        timestamp: new Date(1000).toISOString()
      },
      {
        id: "timeline-3",
        source: "codex",
        level: isApproval ? "warning" : showMousePlan ? "info" : "success",
        message: isApproval ? "Mouse Plan: Review before send" : showMousePlan ? "Mouse Plan: Next best step" : "Active guidance is ready",
        detail: isApproval
          ? "Approval is required before a browser action would execute."
          : showMousePlan
            ? "Displayed as observe-only guidance for the shared screen."
            : "Codex is waiting for a follow-up command or a manual observation refresh.",
        timestamp: new Date(2000).toISOString()
      }
    ],
    finalSummary: undefined
  };
}

function approvalPlanSteps(): PlanStep[] {
  return [
    { ...planSteps[0], status: "completed" },
    { ...planSteps[1], status: "completed" },
    {
      id: "approval-act",
      kind: "act",
      title: "Review risky browser action",
      detail: "Approve, edit, or deny the proposed isolated-browser click before it runs.",
      status: "active",
      confidence: 0.82,
      risk: "high"
    },
    { ...planSteps[3], status: "pending" }
  ];
}

function createObservation(source: ScreenSource, title: string, index: number): ScreenObservation {
  return {
    environment: "screen-share",
    screenshot: createScreenshot(title, source.name, index),
    viewport: { width: 1440, height: 900 },
    sourceId: source.id,
    sourceName: source.name,
    timestamp: new Date(0).toISOString()
  };
}

function createBrowserObservation(): BrowserObservation {
  return {
    environment: "isolated-browser",
    screenshot: createScreenshot("Approval Review", "Isolated Browser - External Send Review", 3),
    viewport: { width: 1440, height: 900 },
    url: "https://example.test/review",
    title: "Approval Review",
    timestamp: new Date(0).toISOString(),
    pageText: "Review before send. External action requires approval."
  };
}

function createScreenshot(title: string, subtitle: string, index: number): string {
  const isEditor = index === 1;
  const isDocs = index === 2;
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
      <rect width="1440" height="900" fill="#11130f"/>
      <rect x="56" y="52" width="1328" height="796" rx="24" fill="#f8f5ee"/>
      <rect x="88" y="92" width="1264" height="58" rx="14" fill="#1f3c34"/>
      <text x="116" y="128" fill="#fffdf8" font-family="Segoe UI, Arial" font-size="24" font-weight="700">${escapeXml(title)}</text>
      <text x="1044" y="128" fill="#dce7e1" font-family="Segoe UI, Arial" font-size="17" font-weight="700">observe -> decide -> guide -> verify</text>
      <text x="88" y="198" fill="#3c3830" font-family="Segoe UI, Arial" font-size="24" font-weight="700">${escapeXml(subtitle)}</text>
      <text x="88" y="230" fill="#6f665b" font-family="Segoe UI, Arial" font-size="16">Synthetic demo workspace for public screenshots. No real screen content.</text>
      <rect x="88" y="264" width="1264" height="2" fill="#ded8cd"/>

      <rect x="88" y="304" width="370" height="460" rx="16" fill="${isDocs ? "#fffaf0" : "#eef4f1"}" stroke="#d6d0c5"/>
      <rect x="488" y="304" width="448" height="460" rx="16" fill="#fffdf8" stroke="#d6d0c5"/>
      <rect x="966" y="304" width="386" height="460" rx="16" fill="${isEditor ? "#f0f4fb" : "#fff8eb"}" stroke="#dfc596"/>

      <text x="118" y="348" fill="#203b33" font-family="Segoe UI, Arial" font-size="18" font-weight="700">${isDocs ? "Docs Context" : "Editor Context"}</text>
      <text x="518" y="348" fill="#203b33" font-family="Segoe UI, Arial" font-size="18" font-weight="700">Plan Board</text>
      <text x="996" y="348" fill="#9b541a" font-family="Segoe UI, Arial" font-size="18" font-weight="700">Mouse Plan</text>

      <rect x="118" y="378" width="310" height="36" rx="8" fill="#17221d"/>
      <circle cx="142" cy="396" r="5" fill="#5ba785"/>
      <circle cx="160" cy="396" r="5" fill="#d5a15b"/>
      <circle cx="178" cy="396" r="5" fill="#b24a42"/>
      <text x="202" y="402" fill="#dbe5df" font-family="Consolas, monospace" font-size="14">${isDocs ? "docs.openai.local" : "src/main/taskSessionManager.ts"}</text>
      ${codeRows(118, 442, isDocs ? ["Computer use guide", "Screen sharing is observe-only", "Browser actions require approval", "Use screenshots to verify state", "Keep credentials out of logs"] : ["const observation = await screen.observe();", "plan.step('decide', context);", "mouse.preview(target, risk);", "if (risk.high) await approve();", "timeline.add('verified');"])}

      <rect x="518" y="384" width="366" height="58" rx="10" fill="#eef7f2"/>
      <text x="540" y="419" fill="#203b33" font-family="Segoe UI, Arial" font-size="16" font-weight="700">1. Read visible context</text>
      <rect x="518" y="464" width="366" height="58" rx="10" fill="#fff8ed"/>
      <text x="540" y="499" fill="#7d4b18" font-family="Segoe UI, Arial" font-size="16" font-weight="700">2. Choose next safe move</text>
      <rect x="518" y="544" width="366" height="58" rx="10" fill="#fffdf8" stroke="#e2dccf"/>
      <text x="540" y="579" fill="#3c3830" font-family="Segoe UI, Arial" font-size="16" font-weight="700">3. Guide or approve action</text>
      <rect x="518" y="624" width="366" height="58" rx="10" fill="#fffdf8" stroke="#e2dccf"/>
      <text x="540" y="659" fill="#3c3830" font-family="Segoe UI, Arial" font-size="16" font-weight="700">4. Verify result</text>

      <path d="M1048 574 C1088 520, 1138 520, 1184 474 S1272 414, 1302 386" fill="none" stroke="#c47a36" stroke-width="8" stroke-linecap="round" opacity="0.42"/>
      <circle cx="1184" cy="474" r="54" fill="none" stroke="#c47a36" stroke-width="8"/>
      <circle cx="1184" cy="474" r="11" fill="#c47a36"/>
      <rect x="1078" y="552" width="214" height="42" rx="10" fill="#203b33"/>
      <text x="1116" y="579" fill="#fffdf8" font-family="Segoe UI, Arial" font-size="16" font-weight="700">Visible target</text>
      <rect x="996" y="640" width="310" height="64" rx="12" fill="#fffdf8" stroke="#ebd3aa"/>
      <text x="1020" y="670" fill="#3c3830" font-family="Segoe UI, Arial" font-size="15" font-weight="700">${isEditor ? "Ask user before running command" : "Review before external action"}</text>
      <text x="1020" y="694" fill="#756b5f" font-family="Segoe UI, Arial" font-size="13">High-risk steps pause for approval.</text>

      <rect x="88" y="798" width="1264" height="22" rx="11" fill="#ebe5d9"/>
    </svg>
  `);
}

function createMiniScreenshot(name: string, index: number): string {
  const colors = ["#223d35", "#475b73", "#9b541a"];
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">
      <rect width="360" height="220" fill="#151814"/>
      <rect x="20" y="22" width="320" height="176" rx="12" fill="#f8f5ee"/>
      <rect x="42" y="48" width="170" height="18" rx="9" fill="${colors[index] ?? colors[0]}"/>
      <rect x="42" y="88" width="250" height="10" rx="5" fill="#b9c7c2"/>
      <rect x="42" y="112" width="210" height="10" rx="5" fill="#d8d2c7"/>
      <text x="42" y="160" fill="#3e3932" font-family="Segoe UI, Arial" font-size="16" font-weight="700">${escapeXml(name)}</text>
    </svg>
  `);
}

function codeRows(x: number, y: number, rows: string[]): string {
  return rows.map((row, index) => {
    const yy = y + index * 42;
    const width = Math.max(140, Math.min(300, row.length * 8));
    return `
      <rect x="${x}" y="${yy - 20}" width="${width}" height="14" rx="7" fill="${index % 2 === 0 ? "#89a49b" : "#c6d1cc"}"/>
      <text x="${x}" y="${yy}" fill="#514a41" font-family="Consolas, monospace" font-size="14">${escapeXml(row)}</text>
    `;
  }).join("");
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
