# Privacy

AI Token Checker has no developer-controlled telemetry or analytics.

## Stored data

VS Code global state stores only the selected provider, provider consent flags, the exact Claude bridge command installed by this extension, and any previous Claude status-line setting needed for rollback. When composition is approved, the previous command is also stored in a permission-restricted bridge configuration file. Usage snapshots remain in memory. The Claude bridge writes one allowlisted metric snapshot in VS Code global storage and replaces it atomically; it is not a history database.

## Data never read or stored

The extension does not read assistant transcripts, prompts, completions, source files, account emails, session IDs, API keys, or provider credential files. For Copilot only, after explicit consent, VS Code's Authentication API supplies a GitHub OAuth token in memory to the bundled official SDK client. AI Token Checker never logs, persists, or displays that token; the SDK passes it directly to the separately installed official Copilot CLI process.

## Network and child processes

- Claude: local snapshot only; the bridge itself performs no network requests.
- Codex: after consent, a local `codex app-server` process may contact OpenAI using Codex-owned authentication.
- Copilot: after consent and a VS Code GitHub sign-in, the bundled official SDK client starts the user's separately installed official Copilot CLI without a shell. That CLI may contact GitHub using the in-memory session token.

AI Token Checker does not create an output channel or log raw provider responses.

When the status-bar indicator is enabled, a previously consented selected provider may refresh in the background at the configured interval. Disabling the status bar and hiding the detailed view stops watchers, refresh timers, and provider processes. Disconnect also revokes the extension's saved consent for that provider.
