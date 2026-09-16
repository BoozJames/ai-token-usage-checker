# Security Policy

## Reporting

Report vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting feature. Do not include real credentials, private prompts, or proprietary source code in a report.

## Design controls

- Provider activity is opt-in and stops when both the detailed view and status indicator are disabled.
- Codex and the packaged official Copilot runtime are spawned without a shell. A previously configured Claude status-line command is invoked through the platform shell only after explicit composition confirmation, with bounded input, output, and runtime.
- Codex JSONL lines and Claude snapshots have explicit size limits.
- Provider payloads are parsed defensively and only known fields are normalized.
- The optional Claude telemetry receiver binds `127.0.0.1` only, starts only after explicit consent, and bounds request body size, request/header timeouts, and connection count. It requires a self-generated header token to accept a request; that token is an anti-crosstalk tag, not a credential, and any local process presenting it can only affect a displayed informational token count — it crosses no trust boundary and cannot access other data.
- Writing to another extension's settings (Claude Code's `environmentVariables`) happens only after modal consent, targets `ConfigurationTarget.Global` (the only valid target for a machine-scoped setting), preserves every entry this extension does not own, and refuses to revert if the stored value changed since setup.
- The on-demand usage-details webview uses a deny-by-default Content Security Policy, extension-local resources, and no webview-to-host commands.
- No credential files, transcripts, raw provider payloads, or source files are logged.
- The bundled Copilot SDK client and the three official x64 runtime artifacts are pinned exactly, packaged from the npm registry in a disposable staging directory, and audited in CI.

## Supported versions

Security fixes are provided for the latest published stable version. Preview and older versions should be upgraded before reporting a problem.
