# Security Policy

## Reporting

Report vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting feature. Do not include real credentials, private prompts, or proprietary source code in a report.

## Design controls

- Provider activity is opt-in and stops when both the detailed view and status indicator are disabled.
- Codex is spawned without a shell. A previously configured Claude status-line command is invoked through the platform shell only after explicit composition confirmation, with bounded input, output, and runtime.
- Codex JSONL lines and Claude snapshots have explicit size limits.
- Provider payloads are parsed defensively and only known fields are normalized.
- The webview uses a deny-by-default Content Security Policy, extension-local resources, and validated inbound messages.
- No credential files, transcripts, raw provider payloads, or source files are logged.
- Production dependencies are pinned exactly and audited in CI.

## Supported versions

Only the latest published preview receives security fixes before a stable release policy is established.
