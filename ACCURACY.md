# Metric Accuracy

Every displayed value carries a source and accuracy label.

- **Claude Code:** provider-reported status-line fields. Context tokens describe the latest live context, not subscription consumption. Subscription windows may be absent.
- **Codex:** provider-reported account rate-limit and usage fields returned by the local app server. These are not OpenAI API billing totals.
- **GitHub Copilot:** provider-reported account quota from the official SDK. Expired quota windows are ignored. GitHub's newer AI Credits dashboard can differ from SDK quota buckets, so the extension labels the exact SDK bucket and does not claim that different metrics are equivalent. Token totals from an existing VS Code Copilot Chat session are unavailable.

The gauge uses the active quota window with the highest consumed percentage. If no quota exists, it uses bounded context usage. Unbounded token totals never become a percentage. Missing, malformed, unsupported, and stale data are identified rather than converted to zero.
