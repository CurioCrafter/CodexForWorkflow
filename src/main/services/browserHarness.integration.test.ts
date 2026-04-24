import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserHarness } from "./browserHarness";

const describeIf = process.env.RUN_BROWSER_HARNESS_TESTS === "1" ? describe : describe.skip;

describeIf("BrowserHarness integration", () => {
  let harness: BrowserHarness | undefined;
  let server: Server | undefined;

  afterEach(async () => {
    await harness?.stop();
    await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
  });

  it("captures screenshots and executes basic page actions", async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<title>Fixture</title><button>Search</button>");
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    harness = new BrowserHarness({
      profileRoot: path.join(process.cwd(), "tmp", "browser-harness-test"),
      viewport: { width: 800, height: 500 }
    });

    let observation = await harness.start("test-session");
    expect(observation.url).toBe("about:blank");

    observation = await harness.execute({
      type: "navigate",
      url: `http://127.0.0.1:${port}/`
    });
    expect(observation.title).toBe("Fixture");
    expect(observation.screenshot).toMatch(/^data:image\/png;base64,/);
  });
});
