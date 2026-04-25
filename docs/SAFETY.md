# Safety And Privacy

CodexForWorkflow is designed around clear separation between observation and control.

## Screen Share Mode

- Screen Share mode is observe-only.
- Codex can inspect screenshots and propose guidance.
- The app does not synthesize desktop mouse or keyboard input.
- Mouse Plan overlays are guidance for the user, not live desktop automation.

## Isolated Browser Mode

- Browser automation runs in an isolated Playwright Chromium profile.
- Browser actions are validated before execution.
- Risky actions pause for approval.
- Downloads, credentials, external sends, account/security changes, deletes, and blocked domains are treated as sensitive flows.

## Local Bridge

- The app exposes tools to Codex through a loopback-only bridge.
- The bridge binds to `127.0.0.1`.
- Each session uses a random token.
- The bridge is stopped when the task stops.

## Data Handling

- Demo screenshots are synthetic and generated from `?demo` mode.
- Logs and timeline entries run through redaction helpers before display.
- The app relies on Codex CLI auth instead of storing custom API keys.

## Known Limits

- The app is not a sandbox for arbitrary websites.
- Unsigned Windows builds may trigger SmartScreen.
- Screen observation can reveal visible user content to the active Codex workflow. Share only sources you intend Codex to inspect.
