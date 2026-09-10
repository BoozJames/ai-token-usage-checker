# Security Policy

## Reporting

Report vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting feature. Do not include real credentials, private prompts, or proprietary source code in a report.

## Design controls

- Provider activity is opt-in and stops when the view is hidden.
- Provider executables are spawned without a shell.
- Codex JSONL lines and Claude snapshots have explicit size limits.
- Provider payloads are parsed defensively and only known fields are normalized.
- The webview uses a deny-by-default Content Security Policy, extension-local resources, and validated inbound messages.
- No credential files, transcripts, raw provider payloads, or source files are logged.
- Production dependencies are pinned exactly and audited in CI.

## Supported versions

Only the latest private release receives security fixes before a public release policy is established.
