import { chromium } from "playwright";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import http from "node:http";

const root = process.cwd();
const rendererDir = path.join(root, "dist", "renderer");
const screenshotDir = path.join(root, "docs", "screenshots");

await mkdir(screenshotDir, { recursive: true });
const server = await serveStatic(rendererDir);

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  await capture(page, server.url, "overview", path.join(screenshotDir, "command-center.png"));
  await capture(page, server.url, "approval", path.join(screenshotDir, "approval-flow.png"));

  await browser.close();
} finally {
  await server.close();
}

async function capture(page, baseUrl, variant, outputPath) {
  await page.goto(`${baseUrl}/?demo=${variant}`, { waitUntil: "networkidle" });
  await page.locator("text=CodexForWorkflow").first().waitFor({ timeout: 10000 });
  await page.locator("text=Live Work Surface").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`captured ${path.relative(root, outputPath)}`);
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
