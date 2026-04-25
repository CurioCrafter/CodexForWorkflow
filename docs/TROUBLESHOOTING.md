# Troubleshooting

## `auth:check` Fails

Use the Auth section's `Check` button first. The app resolves Codex through the Windows-safe Node entrypoint when available.

If Codex is missing, install/sign in with the Codex CLI and verify:

```bash
codex login status
```

## No Screen Sources

- Click `Refresh`.
- Make sure a screen or window is visible.
- Restart the app if a window disappeared while pinned.

## Playwright Browser Does Not Launch

Install the browser runtime:

```bash
npm run prepare:browsers
```

Then rerun:

```bash
npm run check
```

## Windows SmartScreen Warning

Current builds are unsigned. SmartScreen can warn until the app has code signing and publisher reputation.

## Stale Release Files

Run:

```bash
npm run clean:release
npm run package:win
```

The package script validates that release artifacts use the `CodexForWorkflow` name.
