import { describe, expect, it } from "vitest";
import type { ApprovalRequest } from "../../shared/types";
import { describeBrowserAction, parseEditedBrowserAction, summarizeApproval } from "./actionSummary";

describe("describeBrowserAction", () => {
  it("summarizes click actions for approval UI", () => {
    expect(describeBrowserAction({ type: "click", x: 42, y: 91 })).toEqual({
      title: "Click target",
      detail: "left click at 42, 91",
      meta: ["pointer", "left"]
    });
  });

  it("summarizes typing without exposing the typed value", () => {
    expect(describeBrowserAction({ type: "type", text: "secret value" }).detail).toBe("12 characters");
  });
});

describe("summarizeApproval", () => {
  it("includes browser host context when present", () => {
    const approval: ApprovalRequest = {
      id: "approval",
      action: { type: "navigate", url: "https://example.com/path" },
      riskReason: "External send-like action requires approval.",
      createdAt: new Date(0).toISOString(),
      observation: {
        environment: "isolated-browser",
        screenshot: "data:image/png;base64,abc",
        viewport: { width: 100, height: 100 },
        url: "https://docs.example.com/guide",
        title: "Docs",
        timestamp: new Date(0).toISOString()
      }
    };

    expect(summarizeApproval(approval)).toMatchObject({
      title: "Navigate",
      detail: "https://example.com/path on docs.example.com",
      meta: ["navigation", "external"]
    });
  });
});

describe("parseEditedBrowserAction", () => {
  it("parses edited JSON actions", () => {
    expect(parseEditedBrowserAction('{"type":"key","key":"Enter"}')).toEqual({ type: "key", key: "Enter" });
  });

  it("rejects JSON without a type", () => {
    expect(() => parseEditedBrowserAction("{}")).toThrow(/requires a type/);
  });
});
