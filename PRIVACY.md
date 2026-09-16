# Privacy

AI Token Checker has no developer-controlled telemetry or analytics.

## Stored data

VS Code global state stores only the selected provider, provider consent flags, the exact Claude bridge command installed by this extension, and any previous Claude status-line setting needed for rollback. When composition is approved, the previous command is also stored in a permission-restricted bridge configuration file. Usage snapshots remain in memory. The Claude bridge writes one allowlisted metric snapshot in VS Code global storage and replaces it atomically; it is not a history database.

If Claude Code telemetry is enabled (a separate, explicit consent), VS Code global state additionally stores an enabled flag, the exact environment-variable entries this extension wrote into Claude Code's own settings (for exact rollback), and a self-generated token used only to tag requests to this extension's own local receiver — it is not a credential and is never sent anywhere else. A loopback-only HTTP listener on `127.0.0.1` accepts OTLP metrics from Claude Code processes VS Code launches and makes no outbound requests of its own. Live testing against a real account (2026-09-16, Claude Code CLI 2.1.273) showed Claude Code's exporter always attaches the account email, an account-scoped user id, and an organization id to every metric, with no documented flag able to suppress them, contrary to what the exporter's own privacy settings are documented to do. This extension does not rely on those exporter flags: the parser allowlists only the `type` and `model` attributes on the `claude_code.token.usage` counter and discards everything else without storing, logging, or keying by it — see the "Data never read or stored" note below for the precise scope of that guarantee. One current token total is mirrored to a single atomically replaced file in global storage; it is not a history database and is deleted when telemetry is disabled.

## Data never read or stored

The extension does not read assistant transcripts, prompts, completions, source files, account emails, session IDs, API keys, or provider credential files. For Copilot only, after explicit consent, VS Code's Authentication API supplies a GitHub OAuth token in memory to the bundled official SDK client. AI Token Checker never logs, persists, or displays that token; the SDK passes it directly to the packaged official Copilot runtime.

One narrow exception: when Claude Code telemetry is enabled, the account email, an account-scoped user id, and an organization id arrive as part of the raw OTLP request body Claude Code's own exporter sends to this extension's local receiver (see above). That request body is parsed in memory to extract only the numeric token counters; the identifying attributes are never copied into a named value, never used as a lookup key, never logged, and never written to disk. They exist only as part of the transient parsed request for the duration of that single request.

## Network and child processes

- Claude: local snapshot only; the bridge itself performs no network requests. When telemetry is enabled, the only network activity is Claude Code processes VS Code launches sending local OTLP requests to this extension's own loopback receiver; nothing leaves the machine because of this extension.
- Codex: after consent, a local `codex app-server` process may contact OpenAI using Codex-owned authentication.
- Copilot: after consent and a VS Code GitHub sign-in, the bundled official SDK client starts only the current operating system's packaged official Copilot runtime from the universal x64 extension installation. That runtime may contact GitHub using the in-memory session token.

AI Token Checker does not create an output channel or log raw provider responses.

When the status-bar indicator is enabled, a previously consented selected provider may refresh in the background at the configured interval. Disabling the status bar and closing the usage-details editor tab stops watchers, refresh timers, and provider processes. Disconnect also revokes the extension's saved consent for that provider.
