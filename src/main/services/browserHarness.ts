import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import type { BrowserAction, BrowserObservation, Viewport } from "../../shared/types";
import { validateBrowserAction } from "./actionValidation";

export interface BrowserHarnessOptions {
  profileRoot: string;
  viewport?: Viewport;
}

export class BrowserHarness {
  private readonly profileRoot: string;
  private readonly viewport: Viewport;
  private context?: BrowserContext;
  private page?: Page;
  private sessionId?: string;

  constructor(options: BrowserHarnessOptions) {
    this.profileRoot = options.profileRoot;
    this.viewport = options.viewport ?? { width: 1280, height: 720 };
  }

  async start(sessionId: string): Promise<BrowserObservation> {
    this.sessionId = sessionId;
    if (this.context) {
      return this.observe();
    }

    const userDataDir = path.join(this.profileRoot, sessionId);
    await mkdir(userDataDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: this.viewport,
      acceptDownloads: false,
      env: sanitizeBrowserEnv(process.env),
      args: [
        "--disable-extensions",
        "--disable-file-system",
        "--disable-sync",
        "--disable-background-networking",
        "--no-first-run",
        "--no-default-browser-check"
      ]
    });

    this.context.setDefaultTimeout(15000);
    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    await this.page.goto("about:blank");
    return this.observe();
  }

  async stop(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.page = undefined;
    this.sessionId = undefined;
  }

  async reset(): Promise<BrowserObservation> {
    const activeSession = this.sessionId ?? randomUUID();
    await this.stop();
    return this.start(activeSession);
  }

  async observe(): Promise<BrowserObservation> {
    const page = this.requirePage();
    const screenshotBuffer = await page.screenshot({ type: "png", fullPage: false });
    const [title, pageText] = await Promise.all([
      page.title().catch(() => ""),
      page
        .evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "")
        .catch(() => "")
    ]);

    return {
      environment: "isolated-browser",
      screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
      viewport: this.viewport,
      url: page.url(),
      title,
      pageText,
      timestamp: new Date().toISOString()
    };
  }

  async execute(rawAction: unknown): Promise<BrowserObservation> {
    const action = validateBrowserAction(rawAction, this.viewport);
    const page = this.requirePage();

    switch (action.type) {
      case "navigate":
        await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        break;
      case "click":
        await page.mouse.click(action.x, action.y, { button: action.button ?? "left" });
        break;
      case "type":
        await page.keyboard.type(action.text, { delay: 5 });
        break;
      case "key":
        await page.keyboard.press(action.key);
        break;
      case "scroll":
        await page.mouse.wheel(action.deltaX ?? 0, action.deltaY);
        break;
      case "wait":
        await page.waitForTimeout(action.ms);
        break;
      case "screenshot":
        break;
      default:
        assertNever(action);
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
    return this.observe();
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  private requirePage(): Page {
    if (!this.page) {
      throw new Error("Browser harness has not started.");
    }
    return this.page;
  }
}

export function sanitizeBrowserEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowedKeys = [
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "PATH",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "LOCALAPPDATA",
    "APPDATA"
  ];

  const sanitized: NodeJS.ProcessEnv = {};
  for (const key of allowedKeys) {
    const value = env[key];
    if (value) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled browser action: ${JSON.stringify(value)}`);
}
