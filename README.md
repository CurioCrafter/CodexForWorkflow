# CodexOnComputer

CodexOnComputer is a Windows desktop command center for Codex-guided work across screens. It lets a user share screens or windows for observe-only guidance, run approved automation inside an isolated browser, preview mouse intent before action, and keep a visible plan board while working.

This project is independently built by Andrew Rainsberger. It is not an official OpenAI product and is not affiliated with or endorsed by OpenAI.

## What It Does

- Multi-screen workspace: refresh, pin, focus, and observe multiple screens or windows.
- Live Work Surface: a primary screen/browser canvas with secondary context strips.
- Screen Share mode: observe-only guidance for the live desktop. It cannot click or type on your desktop.
- Isolated Browser mode: Playwright Chromium automation with human approval for risky actions.
- Mouse Plan: visible target overlays that show where Codex wants the next action to happen.
- Plan Board: Codex-visible observe, decide, act/guide, and verify workflow steps.
- Safety controls: pause, resume, stop, approvals, blocked domains, and credential/download gates.

## License

CodexOnComputer is source-available and free to use, but it is not open source.

You may download, run, and use unmodified copies for free. You may not claim ownership, relicense it, sell it, publish modified versions, remove ownership notices, or use the code to create a competing derivative. See [LICENSE](LICENSE) for the full terms.

## Requirements

- Windows 10/11
- Node.js 22+
- npm 11+
- Codex CLI installed and signed in

Check Codex auth:

```bash
codex login status
```

## Development

```bash
npm install
npm run prepare:browsers
npm run dev
```

## Production Build

```bash
npm run check
npm run package:win
```

Build output is written to `release/`.

## Scripts

- `npm run dev` starts Vite and Electron.
- `npm run start` starts the built Electron app.
- `npm run typecheck` checks renderer and main TypeScript.
- `npm test` runs Vitest.
- `npm run build` compiles Electron main and renderer assets.
- `npm run check` runs typecheck, tests, and build.
- `npm run package:win` builds Windows installer/portable artifacts.

## Safety Model

CodexOnComputer intentionally separates observation from control:

- Live desktop screen sharing is observe-only.
- Automated clicking/typing is only allowed inside the isolated Playwright browser.
- Sensitive browser flows require approval.
- The local MCP bridge is loopback-only and uses a per-session token.

## Publishing

This repository is intended to be published as:

```text
https://github.com/andrewrainsberger/CodexOnComputer
```

If your GitHub username differs, update `package.json` before pushing.
