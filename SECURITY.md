# Security Policy

## Supported Versions

Only the latest published version is supported.

## Reporting Security Issues

Do not publish security vulnerabilities in public issues.

Use GitHub private vulnerability reporting when available, or report security
concerns directly to the repository owner. Include:

- affected version or commit;
- operating system;
- reproduction steps;
- expected and actual behavior;
- screenshots or logs with secrets removed.

## Safety Boundaries

CodexForWorkflow is designed so live desktop sharing is observe-only. Automated
input is limited to the isolated Playwright browser profile and remains subject
to approval gates.

See [docs/SAFETY.md](docs/SAFETY.md) for the current threat model and known
limits.
