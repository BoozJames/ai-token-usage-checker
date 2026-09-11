# AI Token Checker

AI Token Checker puts the remaining quota for Claude Code, Codex, or GitHub
Copilot in the VS Code status bar. Click it to switch providers, connect,
refresh, or open the full usage breakdown.

It displays only supported provider-reported values. Missing usage is shown as
unavailable—it is never guessed or replaced with zero.

## Quick start

1. Install and sign in to at least one supported provider tool.
2. Install AI Token Checker from the VS Code Marketplace or from a GitHub
   release VSIX.
3. Click **Claude**, **Codex**, or **Copilot** in the bottom status bar.
4. Select a provider and approve its one-time consent prompt.

The status bar shows the selected provider and remaining percentage. Its menu
contains connection, refresh, setup, settings, privacy, and detailed-usage
actions. The Activity Bar view is deliberately read-only: it shows the progress
bar, every reported quota window, reset times, token details, freshness, and
data source without repeating setup controls.

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

Requirements: the official GitHub Copilot CLI and an eligible Copilot account.
The CLI is a separate prerequisite so AI Token Checker does not redistribute
GitHub's roughly 110 MB agent runtime inside this small extension.

Install the CLI using one official method:

```text
# Windows
winget install GitHub.Copilot

# Any supported platform with Node.js 22+
npm install -g @github/copilot
```

Then click the status item and select **GitHub Copilot**. VS Code requests the
GitHub sign-in, keeps its token in memory, and passes it directly to the bundled
official SDK client, which starts your installed `copilot` executable without a
shell. The status menu also links to GitHub's official installation guide.

If the command is not on `PATH`, set `AI Token Checker: Copilot Executable` to
its absolute path in the extension settings.

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
  process or official SDK runtime.

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
