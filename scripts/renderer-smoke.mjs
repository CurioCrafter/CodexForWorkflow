import { chromium } from "playwright";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import http from "node:http";

const root = process.cwd();
const rendererDir = path.join(root, "dist", "renderer");
const outputDir = path.join(root, "tmp", "renderer-smoke");
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 }
];

await mkdir(outputDir, { recursive: true });
const server = await serveStatic(rendererDir);
const browser = await chromium.launch();

try {
  for (const viewport of viewports) {
    for (const variant of ["first-run", "guide", "mouse-plan", "approval"]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });
      await page.goto(`${server.url}/?demo=${variant}`, { waitUntil: "networkidle" });
      await expectVisibleText(page, "CodexForWorkflow");
      await expectVisibleText(page, "Live Work Surface");
      await expectVisibleText(page, expectedVariantText(variant));
      await assertCommandBarVisible(page, variant, viewport);
      const metrics = await page.evaluate(() => ({
        bodyTextLength: document.body.innerText.trim().length,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      }));
      if (metrics.bodyTextLength < 100) {
        throw new Error(`Renderer smoke failed: app appears blank for ${variant} ${viewport.width}x${viewport.height}`);
      }
      if (metrics.scrollWidth > metrics.viewportWidth + 2) {
        throw new Error(`Renderer smoke failed: horizontal overflow ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`);
      }
      if (errors.length > 0) {
        throw new Error(`Renderer smoke failed with console errors: ${errors.join("\n")}`);
      }
      await page.screenshot({
        path: path.join(outputDir, `${variant}-${viewport.width}x${viewport.height}.png`),
        fullPage: true
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log("renderer smoke passed");

async function expectVisibleText(page, text) {
  await page.locator(`text=${text}`).first().waitFor({ timeout: 10000 });
}

function expectedVariantText(variant) {
  switch (variant) {
    case "first-run":
      return "Guided workspace";
    case "guide":
      return "Current step";
    case "mouse-plan":
      return "Mouse Plan";
    case "approval":
      return "Awaiting approval";
    default:
      return "Plan Board";
  }
}

async function assertCommandBarVisible(page, variant, viewport) {
  const rect = await page.locator(".command-bar").first().boundingBox();
  if (!rect) {
    throw new Error(`Renderer smoke failed: command bar missing for ${variant}`);
  }
  if (rect.y + rect.height > viewport.height + 220) {
    throw new Error(`Renderer smoke failed: command bar clipped too far below first screen for ${variant}`);
  }
}

async function serveStatic(directory) {
  const mimeTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".svg", "image/svg+xml"],
    [".png", "image/png"],
    [".ico", "image/x-icon"]
  ]);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const cleanPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(directory, cleanPath));
      if (!filePath.startsWith(directory)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, { "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
