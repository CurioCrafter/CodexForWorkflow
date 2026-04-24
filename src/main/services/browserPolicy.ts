import type {
  BrowserAction,
  BrowserObservation,
  BrowserPolicy,
  PolicyDecision
} from "../../shared/types";

const RISK_WORDS = [
  "login",
  "log-in",
  "signin",
  "sign-in",
  "password",
  "credential",
  "payment",
  "checkout",
  "billing",
  "purchase",
  "delete",
  "remove",
  "upload",
  "submit",
  "send",
  "account",
  "security",
  "privacy",
  "settings",
  "admin"
];

const DOWNLOAD_EXTENSIONS = /\.(zip|exe|msi|dmg|pkg|pdf|csv|xlsx|docx|pptx|7z|rar)(\?|#|$)/i;

export const DEFAULT_POLICY: BrowserPolicy = {
  allowedDomains: [],
  blockedDomains: [
    "bank",
    "paypal.com",
    "stripe.com",
    "coinbase.com",
    "binance.com",
    "robinhood.com"
  ],
  approvalMode: "confirm-risky",
  downloadsAllowed: false,
  credentialEntryAllowed: false,
  retentionDays: 1
};

export function classifyBrowserAction(
  action: BrowserAction,
  observation: BrowserObservation | undefined,
  policy: BrowserPolicy
): PolicyDecision {
  if (policy.approvalMode === "step-by-step") {
    return approval("Step-by-step mode requires approval for every action.");
  }

  const targetUrl = action.type === "navigate" ? action.url : observation?.url;
  const targetHost = targetUrl ? safeHost(targetUrl) : undefined;

  if (targetHost && matchesDomain(targetHost, policy.blockedDomains)) {
    return {
      allowed: false,
      requiresApproval: false,
      riskReason: `Blocked domain: ${targetHost}`
    };
  }

  if (
    action.type === "navigate" &&
    policy.allowedDomains.length > 0 &&
    targetHost &&
    !matchesDomain(targetHost, policy.allowedDomains)
  ) {
    return approval(`Off-allowlist domain: ${targetHost}`);
  }

  if (action.type === "navigate" && DOWNLOAD_EXTENSIONS.test(action.url) && !policy.downloadsAllowed) {
    return approval("Download-like navigation requires approval.");
  }

  const context = [
    action.type === "navigate" ? action.url : "",
    observation?.url ?? "",
    observation?.title ?? "",
    observation?.pageText?.slice(0, 2000) ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (action.type === "type") {
    if (!policy.credentialEntryAllowed && looksLikeCredential(action.text)) {
      return approval("Typed text looks like a credential or secret.");
    }
    if (containsRiskWord(context)) {
      return approval("Typing into a sensitive page requires approval.");
    }
  }

  if (action.type === "key" && ["Enter", "Control+V"].includes(action.key) && containsRiskWord(context)) {
    return approval(`${action.key} on a sensitive page requires approval.`);
  }

  if (action.type === "click" && containsRiskWord(context)) {
    return approval("Clicking inside a sensitive flow requires approval.");
  }

  if (policy.approvalMode === "mostly-autonomous") {
    return { allowed: true, requiresApproval: false };
  }

  return { allowed: true, requiresApproval: false };
}

export function safeHost(rawUrl: string): string | undefined {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return undefined;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function matchesDomain(host: string, domains: string[]): boolean {
  const normalizedHost = host.toLowerCase();
  return domains
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
    .some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`) || normalizedHost.includes(domain));
}

function containsRiskWord(input: string): boolean {
  return RISK_WORDS.some((word) => input.includes(word));
}

function looksLikeCredential(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length >= 24 && /[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed) && /\d/.test(trimmed)) {
    return true;
  }
  if (/^(sk-|pk_|ghp_|gho_|xox[baprs]-)/i.test(trimmed)) {
    return true;
  }
  return /(password|token|secret|api[_-]?key)\s*[:=]/i.test(trimmed);
}

function approval(riskReason: string): PolicyDecision {
  return { allowed: true, requiresApproval: true, riskReason };
}
