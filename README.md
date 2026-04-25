# CodexForWorkflow

[![CI](https://github.com/CurioCrafter/CodexForWorkflow/actions/workflows/ci.yml/badge.svg)](https://github.com/CurioCrafter/CodexForWorkflow/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/CurioCrafter/CodexForWorkflow?include_prereleases&label=release)](https://github.com/CurioCrafter/CodexForWorkflow/releases)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Node](https://img.shields.io/badge/node-22%2B-green)
![Electron](https://img.shields.io/badge/Electron-TypeScript-2f6f9f)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Windows desktop command center for Codex-guided screen observation, isolated browser automation, visible action planning, and human-approved workflow control.

This project is independently built by Andrew Rainsberger. It is not an official OpenAI product and is not affiliated with or endorsed by OpenAI.

![CodexForWorkflow command center](docs/screenshots/command-center.png)

## What It Is

CodexForWorkflow gives Codex a controlled place to help you work across screens. It can observe selected screens or windows, narrate what it sees, maintain a visible plan, propose mouse intent, and automate an isolated Playwright browser only when the safety policy allows it.

## What It Is Not

- It is not live desktop control. Screen Share mode is observe-only.
- It is not an official OpenAI product.
- It is not a hosted service. The app runs locally and uses your local Codex/ChatGPT auth path.
- It does not bypass approvals for sensitive browser actions.

## Capabilities

- Multi-screen workspace: refresh, pin, focus, and observe multiple screens or windows.
- Live Work Surface: a primary screen/browser canvas with secondary context strips.
- Screen Share mode: observe-only guidance for the live desktop.
- Isolated Browser mode: Playwright Chromium automation with approval gates.
- Mouse Plan: visible target overlays before user-guided or browser-automated actions.
- Plan Board: Codex-visible observe, decide, act/guide, and verify workflow steps.
- Workflow presets: guide a screen, automate a browser, compare research windows, or debug with an assistant.
- Safety controls: pause, resume, stop, approvals, blocked domains, and credential/download gates.

![CodexForWorkflow approval flow](docs/screenshots/approval-flow.png)

## Install

Download the latest Windows build from [GitHub Releases](https://github.com/CurioCrafter/CodexForWorkflow/releases).

- `setup-win-x64.exe` installs the app.
- `portable-win-x64.exe` runs without installation.
- Builds are currently unsigned, so Windows SmartScreen may warn on first launch.

See [docs/INSTALL.md](docs/INSTALL.md) for prerequisites and first-run notes.

## Quick Start

1. Install Node.js 22+ and the Codex CLI.
2. Sign in with Codex:

   ```bash
   codex login status
   ```

3. Install dependencies and Playwright Chromium:

   ```bash
   npm install
   npm run prepare:browsers
   ```

4. Start development mode:

   ```bash
   npm run dev
   ```

## Development

```bash
npm run check
npm run screenshots
npm run package:win
```

Build output is written to `release/`. Packaging starts from a clean `dist/` and `release/` directory so stale product names do not ship.

## Safety And Privacy

CodexForWorkflow intentionally separates observation from control:

- Live desktop screen sharing is observe-only.
- Automated clicking/typing is only allowed inside the isolated Playwright browser.
- Sensitive browser flows require approval.
- The local MCP bridge is loopback-only and uses a per-session token.
- Demo screenshots are generated from synthetic `?demo` state and do not include real screen content.

See [docs/SAFETY.md](docs/SAFETY.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for implementation details.

## Scripts

- `npm run dev` starts Vite and Electron.
- `npm run check` runs typecheck, tests, production build, and renderer smoke checks.
- `npm run screenshots` regenerates README screenshots from deterministic demo mode.
- `npm run package:win` builds Windows installer/portable artifacts and validates release names.
- `npm run clean` removes `dist/` and `release/`.

## Contributing

Public contributions are welcome under the MIT License. Read [CONTRIBUTING.md](CONTRIBUTING.md) and use the pull request template so UI, safety, and test impact are clear.

## License

CodexForWorkflow is open source under the [MIT License](LICENSE).

You can use, copy, modify, publish, distribute, sublicense, and sell copies of the software, as long as the copyright and license notice stay with the software.
