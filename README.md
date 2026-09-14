# AI Token Checker

AI Token Checker puts the remaining quota for Claude Code, Codex, or GitHub
Copilot in the VS Code status bar. Click it to switch providers, connect,
refresh, or open the full usage breakdown.

It displays only supported provider-reported values. Missing usage is shown as
unavailable—it is never guessed or replaced with zero.

## Quick start

1. Install and sign in to at least one supported provider tool.
2. Install AI Token Checker from the VS Code Marketplace or install the GitHub
   release VSIX that matches your operating system.
3. Click **Claude**, **Codex**, or **Copilot** in the bottom status bar.
4. Select a provider and approve its one-time consent prompt.

The status bar shows the selected provider and remaining percentage. Hover it
for quota windows, reset times, token details, freshness, and data source. Click
it to open a menu with the current provider first, followed by other providers
and connection, refresh, setup, settings, privacy, and detailed-usage actions.
**Open usage details** opens the full progress gauge in an editor tab only when
needed; the extension does not add an Activity Bar icon or permanent sidebar.

## Provider setup

### Claude Code

Requirements: Claude Code 2.1.251 or newer and a Claude CLI login.

1. Install or update Claude Code, then authenticate it using Claude's own CLI.
2. Click the AI Token Checker status item and select **Claude Code**.
3. In the same menu, choose **Set up or repair Claude bridge**.
4. Restart the Claude CLI and complete one assistant response.

The bridge receives Claude's documented status-line JSON and writes one
allowlisted local snapshot containing quota, reset, and context-token metrics.
It does not read transcripts or Claude credentials. A claude.ai browser login
cannot be imported into the Claude CLI.

### Codex

Requirements: an authenticated Codex CLI or the official OpenAI VS Code
extension containing Codex.

Click the status item and select **Codex**. AI Token Checker starts
`codex app-server` directly without a shell and asks it for the documented
account rate limits and usage summary. Codex continues to own authentication.

If auto-detection does not find Codex, open **Open extension settings** from the
status menu and set `AI Token Checker: Codex Executable` to the executable's
absolute path.

### GitHub Copilot

Requirements: an eligible Copilot account. A separate GitHub Copilot CLI
installation is not required.

Click the status item and select **GitHub Copilot**. VS Code requests the GitHub
sign-in and keeps its token in memory. The bundled official SDK client starts
the packaged, platform-specific official Copilot runtime and requests account
quota. Install the VSIX matching your operating system; a Windows package does
not contain the Linux or macOS runtime.

## Privacy

AI Token Checker has no developer-controlled telemetry, analytics, or usage
history.

- It does not read prompts, assistant transcripts, source files, Claude or
  Codex credential files, account emails, or API keys.
- It does not log raw provider responses or authentication tokens.
- Provider access begins only after explicit consent.
- Usage snapshots stay in memory, except for the single allowlisted Claude
  bridge snapshot that is atomically replaced in VS Code global storage.
- Network access is performed by the selected provider's own authenticated
  process or the packaged official SDK runtime.

See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and
[ACCURACY.md](ACCURACY.md) for the complete boundaries and metric semantics.

## Supported environment

- Local desktop VS Code 1.95 or newer.
- Windows, macOS, and Linux.
- WSL, Remote SSH, Dev Containers, and VS Code for the Web are not supported in
  this first stable release.
- Provider plans and APIs differ; some accounts may not expose every quota
  window shown in the provider's own application.

## Help and contributing

For troubleshooting and safe bug-reporting guidance, see
[SUPPORT.md](SUPPORT.md). Developers and contributors should start with
[CONTRIBUTING.md](CONTRIBUTING.md); implementation and release details stay out
of this user guide.
