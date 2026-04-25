# Releasing

Use this checklist before creating a public GitHub Release.

## Local Checks

```bash
npm run check
npm run screenshots
npm run package:win
```

## Expected Artifacts

The `release/` directory should contain:

- `CodexForWorkflow-<version>-setup-win-x64.exe`
- `CodexForWorkflow-<version>-portable-win-x64.exe`
- `CodexForWorkflow-<version>-setup-win-x64.exe.blockmap`
- `win-unpacked/`

No legacy product-name or old abbreviation artifacts should be present.

## GitHub Release Notes

Include:

- what changed;
- install instructions;
- unsigned Windows build note;
- checks run;
- known limitations.

## Metadata

Recommended repository description:

`Windows desktop command center for Codex-guided screen observation and human-approved isolated browser automation.`

Recommended topics:

`codex`, `openai`, `electron`, `typescript`, `react`, `playwright`, `windows`, `desktop-app`, `automation`, `human-in-the-loop`, `workflow`, `ai-assistant`, `screen-observation`
