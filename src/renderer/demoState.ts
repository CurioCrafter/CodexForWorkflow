import type { AppState, PlanStep, ScreenObservation, ScreenSource } from "../shared/types";

const sources: ScreenSource[] = [
  { id: "screen:demo-main:0", name: "Main Display - Research Workspace", type: "screen" },
  { id: "window:demo-editor:0", name: "Editor - Workflow Notes", type: "window" },
  { id: "window:demo-browser:0", name: "Browser - Product Docs", type: "window" }
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

export function createDemoState(variant: string | null): AppState {
  const observations = Object.fromEntries(
    sources.map((source, index) => [
      source.id,
      createObservation(source, index === 0 ? "Live Work Surface" : index === 1 ? "Plan Notes" : "Docs Reference")
    ])
  ) as Record<string, ScreenObservation>;

  return {
    authStatus: "Logged in using ChatGPT\nCodex CLI=demo\nNode=demo",
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
    screenSharing: true,
    observation: observations[sources[0].id],
    policy: {
      allowedDomains: [],
      blockedDomains: ["bank", "paypal.com", "stripe.com"],
      approvalMode: "confirm-risky",
      downloadsAllowed: false,
      credentialEntryAllowed: false,
      retentionDays: 1
    },
    planSteps,
    activePlanStepId: "decide",
    mousePlan: {
      id: "mouse-demo",
      environment: "screen-share",
      executionMode: "screen-guidance",
      sourceId: sources[0].id,
      sourceName: sources[0].name,
      viewport: { width: 1440, height: 900 },
      x: variant === "approval" ? 980 : 1040,
      y: variant === "approval" ? 520 : 410,
      intent: variant === "approval" ? "click" : "guide",
      label: variant === "approval" ? "Review before send" : "Next best step",
      rationale:
        variant === "approval"
          ? "This action could send information externally, so the user should approve it first."
          : "This target advances the workflow while keeping desktop control in the user's hands.",
      risk: variant === "approval" ? "high" : "medium",
      createdAt: new Date(0).toISOString()
    },
    pendingApprovals:
      variant === "approval"
        ? [
            {
              id: "approval-demo",
              action: { type: "click", x: 980, y: 520, button: "left" },
              riskReason: "External send-like action requires approval.",
              screenshot: observations[sources[0].id].screenshot,
              observation: observations[sources[0].id],
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
        message: "Sharing Main Display - Research Workspace.",
        timestamp: new Date(1000).toISOString()
      },
      {
        id: "timeline-3",
        source: "codex",
        level: variant === "approval" ? "warning" : "info",
        message: variant === "approval" ? "Mouse Plan: Review before send" : "Mouse Plan: Next best step",
        detail:
          variant === "approval"
            ? "Approval is required before a browser action would execute."
            : "Displayed as observe-only guidance for the shared screen.",
        timestamp: new Date(2000).toISOString()
      }
    ],
    finalSummary: undefined
  };
}

function createObservation(source: ScreenSource, title: string): ScreenObservation {
  return {
    environment: "screen-share",
    screenshot: createScreenshot(title, source.name),
    viewport: { width: 1440, height: 900 },
    sourceId: source.id,
    sourceName: source.name,
    timestamp: new Date(0).toISOString()
  };
}

function createScreenshot(title: string, subtitle: string): string {
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
      <rect width="1440" height="900" fill="#151814"/>
      <rect x="64" y="64" width="1312" height="772" rx="26" fill="#f8f5ee"/>
      <rect x="104" y="112" width="540" height="44" rx="10" fill="#223d35"/>
      <text x="128" y="141" fill="#fffdf8" font-family="Segoe UI, Arial" font-size="22" font-weight="700">${escapeXml(title)}</text>
      <text x="104" y="200" fill="#4a463f" font-family="Segoe UI, Arial" font-size="22" font-weight="700">${escapeXml(subtitle)}</text>
      <rect x="104" y="238" width="1232" height="2" fill="#ded8cd"/>
      <rect x="104" y="284" width="350" height="430" rx="16" fill="#eef4f1"/>
      <rect x="494" y="284" width="390" height="430" rx="16" fill="#fffdf8" stroke="#d9d2c6"/>
      <rect x="924" y="284" width="412" height="430" rx="16" fill="#fff9ee" stroke="#e8c99f"/>
      <text x="134" y="332" fill="#223d35" font-family="Segoe UI, Arial" font-size="18" font-weight="700">Observation</text>
      <text x="524" y="332" fill="#223d35" font-family="Segoe UI, Arial" font-size="18" font-weight="700">Plan Board</text>
      <text x="954" y="332" fill="#9b541a" font-family="Segoe UI, Arial" font-size="18" font-weight="700">Mouse Plan</text>
      <rect x="134" y="368" width="260" height="14" rx="7" fill="#8ea79f"/>
      <rect x="134" y="400" width="220" height="14" rx="7" fill="#b9c7c2"/>
      <rect x="134" y="432" width="300" height="14" rx="7" fill="#b9c7c2"/>
      <rect x="524" y="372" width="310" height="54" rx="10" fill="#eef7f2"/>
      <rect x="524" y="446" width="310" height="54" rx="10" fill="#f8f5ee"/>
      <rect x="524" y="520" width="310" height="54" rx="10" fill="#f8f5ee"/>
      <circle cx="1100" cy="490" r="48" fill="none" stroke="#c47a36" stroke-width="8"/>
      <circle cx="1100" cy="490" r="10" fill="#c47a36"/>
      <rect x="1002" y="566" width="206" height="38" rx="10" fill="#223d35"/>
      <text x="1030" y="591" fill="#fffdf8" font-family="Segoe UI, Arial" font-size="16" font-weight="700">Visible target</text>
      <rect x="104" y="756" width="1232" height="34" rx="12" fill="#ebe5d9"/>
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
