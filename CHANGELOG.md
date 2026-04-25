# Changelog

## Unreleased

## 0.1.1 - 2026-04-25

### Changed

- Reworked the app around a guided workspace with setup, current step, live surface, and Ask Codex controls.
- Made Plan Board steps interactive with ask, done, skip, observe, and blocked actions.
- Made Mouse Plan guidance clearer for screen-share and isolated-browser workflows.
- Regenerated public screenshots for first-run, guided workflow, Mouse Plan, and approval flow states.

### Added

- Added follow-up command, observe-current, and local plan-step update IPC methods.
- Added tests for guided workflow helpers, manager follow-up commands, local plan updates, and observe-only Mouse Plan safety.

## 0.1.0 - 2026-04-25

### Changed

- Refactored the renderer into public-facing command-center components.
- Improved README, docs, CI artifact hygiene, and deterministic demo screenshots.
- Added release validation and renderer smoke checks.

### Added

- Added install, safety, architecture, troubleshooting, and release docs.
- Added PR template, issue template guidance, and Dependabot configuration.

### Added

- Initial MIT-licensed release.
- Added Codex-authenticated app-server integration.
- Added isolated Playwright browser automation with screenshot feedback.
- Added observe-only screen sharing for screens and windows.
- Added multi-source workspace, Plan Board, Mouse Plan overlays, approvals, and workflow presets.
