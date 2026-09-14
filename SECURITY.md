# Security Policy

## Reporting

Report vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting feature. Do not include real credentials, private prompts, or proprietary source code in a report.

## Design controls

- Provider activity is opt-in and stops when both the detailed view and status indicator are disabled.
- Codex and the packaged official Copilot runtime are spawned without a shell. A previously configured Claude status-line command is invoked through the platform shell only after explicit composition confirmation, with bounded input, output, and runtime.
- Codex JSONL lines and Claude snapshots have explicit size limits.
- Provider payloads are parsed defensively and only known fields are normalized.
- The on-demand usage-details webview uses a deny-by-default Content Security Policy, extension-local resources, and no webview-to-host commands.
- No credential files, transcripts, raw provider payloads, or source files are logged.
- The bundled Copilot SDK client and its platform-specific official runtime are pinned exactly, packaged from production dependencies, and audited in CI.

## Supported versions

Security fixes are provided for the latest published stable version. Preview and older versions should be upgraded before reporting a problem.
