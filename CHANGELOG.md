# Changelog

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
