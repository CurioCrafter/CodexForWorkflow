import { describe, expect, it } from "vitest";
import { normalizeUrl, scaleCoordinates, validateBrowserAction } from "./actionValidation";

const viewport = { width: 1280, height: 720 };

describe("validateBrowserAction", () => {
  it("normalizes navigation URLs", () => {
    expect(validateBrowserAction({ type: "navigate", url: "example.com" }, viewport)).toEqual({
      type: "navigate",
      url: "https://example.com/"
    });
  });

  it("rejects unsupported protocols", () => {
    expect(() => normalizeUrl("file:///C:/secret.txt")).toThrow(/Only http/);
  });

  it("rejects out-of-bounds clicks", () => {
    expect(() => validateBrowserAction({ type: "click", x: 1500, y: 20 }, viewport)).toThrow(
      /outside the viewport/
    );
  });

  it("limits wait duration", () => {
    expect(() => validateBrowserAction({ type: "wait", ms: 12000 }, viewport)).toThrow(/between/);
  });
});

describe("scaleCoordinates", () => {
  it("scales between viewports", () => {
    expect(scaleCoordinates(640, 360, viewport, { width: 1920, height: 1080 })).toEqual({
      x: 960,
      y: 540
    });
  });
});
