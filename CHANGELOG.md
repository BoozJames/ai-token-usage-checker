# Changelog

## 0.1.8

- Claude bridge setup now records an absolute Node.js executable instead of relying on the status-line shell PATH.
- Claude bridge installations request a 60-second status-line refresh.
- Repair Bridge migrates existing installations to the hardened command without requiring an uninstall.

## 0.1.7

- The provider Quick Pick uses artwork from installed official provider extensions, with VS Code theme-icon fallbacks.
- Installation guidance now calls out the Claude Code 2.1.251 minimum for 5-hour and 7-day quota fields.
- Provider trademark ownership and non-endorsement are documented.

## 0.1.6

- Claude's empty state now explains that a CLI status-line event and Claude Code 2.1.251+ are required for quota windows.
- Running Claude setup again can repair the installed bridge without changing its command.
- Copilot quota reset transitions are identified as temporary informational states instead of generic warnings.
- Rounded used and remaining values now always add up to 100%.

## 0.1.5

- The sidebar now lists every active quota window as compact text, including used, remaining, and reset values.
- Provider token totals remain visible as secondary sidebar details without replacing an available quota gauge.
- The bottom status item stays compact and continues to show only the selected primary quota.

## 0.1.4

- Active quota windows take precedence over token totals; expired windows are excluded centrally.
- Codex 300-minute and 10,080-minute windows are labelled 5-hour and Weekly limits.
- Token totals are hidden while a quota window is available.
- Claude bridge can compose with an existing command after confirmation and restore it on removal.

## 0.1.3

- Initial private release.
- Single responsive usage gauge for Claude Code, Codex, and GitHub Copilot.
- Compact top-centered horizontal gauge with used and remaining percentages.
- Automatic discovery of the Codex binary bundled with the official OpenAI extension.
- Copilot sign-in through VS Code's Authentication API after explicit consent.
- Always-visible native status-bar indicator and editor-title shortcut.
- Provider Quick Pick from both native indicators; no sidebar navigation required to switch assistants.
- Expired Copilot quota windows are ignored and completion quota uses the Inline Suggestions label.
- Consent-gated, provider-reported integrations with explicit accuracy states.
