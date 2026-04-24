import type { BrowserAction, Viewport } from "../../shared/types";

const MAX_TYPE_LENGTH = 4000;
const MAX_WAIT_MS = 10000;
const MAX_SCROLL_DELTA = 5000;
const ALLOWED_BUTTONS = new Set(["left", "right", "middle"]);
const ALLOWED_SPECIAL_KEYS = new Set([
  "Enter",
  "Tab",
  "Escape",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Control+A",
  "Control+C",
  "Control+V",
  "Control+X"
]);

export function validateBrowserAction(action: unknown, viewport: Viewport): BrowserAction {
  if (!action || typeof action !== "object") {
    throw new Error("Action must be an object.");
  }

  const candidate = action as Record<string, unknown>;
  if (typeof candidate.type !== "string") {
    throw new Error("Action type is required.");
  }

  switch (candidate.type) {
    case "navigate": {
      if (typeof candidate.url !== "string" || candidate.url.trim().length === 0) {
        throw new Error("Navigate action requires a URL.");
      }
      return { type: "navigate", url: normalizeUrl(candidate.url) };
    }
    case "click": {
      const x = validateCoordinate(candidate.x, viewport.width, "x");
      const y = validateCoordinate(candidate.y, viewport.height, "y");
      const button = typeof candidate.button === "string" ? candidate.button : "left";
      if (!ALLOWED_BUTTONS.has(button)) {
        throw new Error(`Unsupported mouse button: ${button}`);
      }
      return { type: "click", x, y, button: button as "left" | "right" | "middle" };
    }
    case "type": {
      if (typeof candidate.text !== "string") {
        throw new Error("Type action requires text.");
      }
      if (candidate.text.length > MAX_TYPE_LENGTH) {
        throw new Error(`Type action exceeds ${MAX_TYPE_LENGTH} characters.`);
      }
      return { type: "type", text: candidate.text };
    }
    case "key": {
      if (typeof candidate.key !== "string" || candidate.key.trim().length === 0) {
        throw new Error("Key action requires a key.");
      }
      const key = candidate.key.trim();
      if (!ALLOWED_SPECIAL_KEYS.has(key) && !/^[A-Za-z0-9]$/.test(key)) {
        throw new Error(`Unsupported key: ${key}`);
      }
      return { type: "key", key };
    }
    case "scroll": {
      const deltaY = validateDelta(candidate.deltaY, "deltaY");
      const deltaX =
        candidate.deltaX === undefined ? undefined : validateDelta(candidate.deltaX, "deltaX");
      return { type: "scroll", deltaX, deltaY };
    }
    case "wait": {
      if (typeof candidate.ms !== "number" || !Number.isFinite(candidate.ms)) {
        throw new Error("Wait action requires milliseconds.");
      }
      const ms = Math.round(candidate.ms);
      if (ms < 0 || ms > MAX_WAIT_MS) {
        throw new Error(`Wait must be between 0 and ${MAX_WAIT_MS}ms.`);
      }
      return { type: "wait", ms };
    }
    case "screenshot":
      return { type: "screenshot" };
    default:
      throw new Error(`Unsupported action type: ${candidate.type}`);
  }
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:", "about:"].includes(parsed.protocol)) {
    throw new Error("Only http, https, and about URLs are allowed.");
  }

  return parsed.toString();
}

export function scaleCoordinates(
  x: number,
  y: number,
  from: Viewport,
  to: Viewport
): { x: number; y: number } {
  if (from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) {
    throw new Error("Viewport dimensions must be positive.");
  }
  return {
    x: Math.round((x / from.width) * to.width),
    y: Math.round((y / from.height) * to.height)
  };
}

function validateCoordinate(value: unknown, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Click action requires numeric ${label}.`);
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > max) {
    throw new Error(`${label} coordinate is outside the viewport.`);
  }
  return rounded;
}

function validateDelta(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Scroll action requires numeric ${label}.`);
  }
  const rounded = Math.round(value);
  if (Math.abs(rounded) > MAX_SCROLL_DELTA) {
    throw new Error(`${label} is too large.`);
  }
  return rounded;
}
