# AI Token Checker

AI Token Checker is a private, local-first VS Code extension that shows one honest usage gauge for Claude Code, OpenAI Codex, or GitHub Copilot.

## What it shows

- One selected provider at a time.
- The most-consumed provider-reported quota window when one exists.
- A compact sidebar breakdown of every active quota window, including used, remaining, and reset values.
- Bounded context usage as a fallback.
- Provider-reported token totals as secondary sidebar details, or an indeterminate bar when no meaningful maximum exists.
- Source, accuracy, freshness, and reset time alongside the gauge.

The view uses one compact horizontal gauge centered at the top of its container. Move it with **View: Move View** or by dragging **Usage Gauge** to another view container. VS Code does not allow extensions to place a floating gauge over the title bar or at arbitrary screen coordinates.

A native status item shows only the selected provider and its primary remaining percentage at the inner edge of the bottom-right status group, as close to the center as VS Code's alignment API permits. The sidebar retains the detailed window and token breakdown. The status item and editor-title dashboard button open a Quick Pick for switching providers, refreshing, or opening detailed diagnostics. The editor-title button appears only when a normal editor tab is active; VS Code does not show it on the Welcome page or Chat view. Disable the status item with `AI Token Checker: Status Bar Enabled`; disabling it also stops background provider refresh when the detailed view is closed.

## Install privately

Download the VSIX and matching SHA-256 file from the private GitHub release, verify the checksum, then run **Extensions: Install from VSIX…**. For local development:

```text
npm ci
npm run check
npm run package
code --install-extension ai-token-checker.vsix
```

Claude users should update the Claude Code CLI before connecting:

```text
claude update
claude --version
```

Claude Code 2.1.251 or newer is required for provider-reported 5-hour and 7-day quota fields. A newly installed current Claude Code CLI should satisfy this requirement, but the version check remains useful for package-manager, managed, and older installations.

## Connect a provider

Open the AI Token Checker activity-bar view, select a provider, and choose **Connect**. Each integration remains off until you accept its provider-specific consent prompt.

### Claude Code

Choose **Set up Claude**. With confirmation, the extension installs a small status-line bridge in VS Code global storage and adds it to Claude's user `settings.json`. If another command already exists, setup offers to compose it: the bridge forwards the original JSON and status-line output unchanged while independently writing the allowlisted metric snapshot. Removal restores the previous command. The bridge allowlists quota percentages, reset times, and current context token counts. It does not copy prompts, completions, session IDs, paths, or credentials into the metric snapshot.

If Claude already has a `statusLine` command, the extension will not change it without explicit composition confirmation. The approved bridge invokes that same user-configured command through the platform shell because that is how Claude status-line commands are defined. The command, input, and output are never logged.

Use **AI Token Checker: Remove Claude Code Bridge** to remove settings installed by this extension. If the setting changed after installation, it is left untouched.

The bridge receives status-line events from a Claude Code CLI session. Start or restart `claude` in a terminal and send a message after setup; using only the graphical Claude panel may not produce a terminal status-line event. Claude rate-limit fields require Claude Code 2.1.251 or newer, a supported account, and the first API response.

### Codex

The extension spawns the configured `codex` executable directly as `codex app-server`, performs the required initialization handshake, and requests `account/rateLimits/read` plus `account/usage/read`. When the default executable name is used, it can locate the Codex binary bundled with the official OpenAI VS Code extension. Codex owns authentication. API-key-only or unsupported accounts may not return ChatGPT quota/token activity.

The executable can be changed with `aiTokenChecker.codex.executable`. It must be an executable name or absolute path; no shell command or arguments are accepted.

### GitHub Copilot

After consent, the extension requests a GitHub session through VS Code's official Authentication API, passes that token directly to the pinned official GitHub Copilot SDK runtime, and calls `account.getQuota`. The token is kept in memory only and is never logged or written by this extension. Existing Copilot Chat token totals are not exposed through a supported cross-extension interface, so the gauge displays official bounded quota only and says when session tokens are unavailable.

## Commands

- **AI Token Checker: Refresh**
- **AI Token Checker: Connect Selected Provider**
- **AI Token Checker: Disconnect Selected Provider**
- **AI Token Checker: Set Up Claude Code Bridge**
- **AI Token Checker: Remove Claude Code Bridge**

## Development

Requires Node.js 20.19+ and VS Code 1.95+. Press `F5` to start the Extension Development Host.

The packaged `PRIVACY.md`, `ACCURACY.md`, `SECURITY.md`, and `CONTRIBUTING.md` files contain the detailed policies.

The provider Quick Pick displays artwork directly from the installed official Claude Code, OpenAI Codex, and GitHub Copilot extensions. Those files are not copied into AI Token Checker. A VS Code theme icon is used when an official provider extension is unavailable.

## Current scope

V1 targets local desktop VS Code on Windows, macOS, and Linux x64. WSL, Remote SSH, Dev Containers, VS Code for the Web, history, telemetry, and additional providers are intentionally deferred.
