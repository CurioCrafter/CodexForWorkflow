import { describe, expect, it } from "vitest";
import type { BrowserObservation, BrowserPolicy } from "../../shared/types";
import { classifyBrowserAction, DEFAULT_POLICY, matchesDomain } from "./browserPolicy";

const observation: BrowserObservation = {
  environment: "isolated-browser",
  screenshot: "data:image/png;base64,abc",
  viewport: { width: 1280, height: 720 },
  url: "https://example.com/",
  title: "Example",
  timestamp: new Date(0).toISOString(),
  pageText: "A simple page"
};

describe("browserPolicy", () => {
  it("matches subdomains", () => {
    expect(matchesDomain("login.example.com", ["example.com"])).toBe(true);
  });

  it("blocks configured domains", () => {
    const decision = classifyBrowserAction(
      { type: "navigate", url: "https://paypal.com/signin" },
      observation,
      DEFAULT_POLICY
    );
    expect(decision.allowed).toBe(false);
    expect(decision.riskReason).toMatch(/Blocked domain/);
  });

  it("requires approval for off-allowlist navigation", () => {
    const policy: BrowserPolicy = { ...DEFAULT_POLICY, allowedDomains: ["example.com"] };
    const decision = classifyBrowserAction(
      { type: "navigate", url: "https://openai.com/" },
      observation,
      policy
    );
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it("requires approval when typing in sensitive context", () => {
    const decision = classifyBrowserAction(
      { type: "type", text: "hello" },
      { ...observation, pageText: "Sign in with password" },
      DEFAULT_POLICY
    );
    expect(decision.requiresApproval).toBe(true);
  });

  it("allows benign clicks", () => {
    const decision = classifyBrowserAction({ type: "click", x: 10, y: 20 }, observation, DEFAULT_POLICY);
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });
});
