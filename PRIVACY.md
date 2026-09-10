# Privacy

AI Token Checker has no developer-controlled telemetry or analytics.

## Stored data

VS Code global state stores only the selected provider, provider consent flags, and the exact Claude bridge command installed by this extension. Usage snapshots remain in memory. The Claude bridge writes one allowlisted metric snapshot in VS Code global storage and replaces it atomically; it is not a history database.

## Data never read or stored

The extension does not read assistant transcripts, prompts, completions, source files, account emails, session IDs, API keys, OAuth tokens, or provider credential files. Logs and UI errors are sanitized and bounded.

## Network and child processes

- Claude: local snapshot only; the bridge itself performs no network requests.
- Codex: after consent, a local `codex app-server` process may contact OpenAI using Codex-owned authentication.
- Copilot: after consent, the official Copilot SDK runtime may contact GitHub using Copilot-owned authentication.

Hiding the view stops watchers, refresh timers, and provider processes. Disconnect also revokes the extension's saved consent for that provider.
