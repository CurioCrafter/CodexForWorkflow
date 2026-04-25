# Install CodexForWorkflow

CodexForWorkflow is a Windows desktop app. The fastest path for users is a GitHub Release build; the developer path uses npm and Electron.

## Requirements

- Windows 10 or Windows 11
- Codex CLI installed
- ChatGPT/Codex sign-in available through the Codex CLI
- Node.js 22+ and npm 11+ for development

## Release Builds

Download the latest release from:

https://github.com/CurioCrafter/CodexForWorkflow/releases

Choose one artifact:

- `CodexForWorkflow-<version>-setup-win-x64.exe` for a normal installer.
- `CodexForWorkflow-<version>-portable-win-x64.exe` for a portable build.

Builds are currently unsigned. Windows SmartScreen may warn on first launch because the binary has no publisher reputation yet.

## First Run

1. Launch the app.
2. Click `Check` in the Auth section.
3. If Codex is not signed in, click `Login`.
4. Use Screen Share for observe-only guidance or Isolated Browser for approved browser automation.

The app does not store custom OpenAI tokens. It relies on the local Codex CLI/auth path.

## Developer Setup

```bash
npm install
npm run prepare:browsers
npm run dev
```

For production validation:

```bash
npm run check
npm run package:win
```
