# Architecture and Invariants

## Primary components

- `src/model.ts`: normalized provider snapshot model and gauge-selection rules.
- `src/controller.ts`: consent, provider lifecycle, refresh scheduling, stale-state handling, and persistence.
- `src/providers/`: Claude, Codex, and Copilot adapters.
- `src/claudeSetup.ts` and `resources/claude-bridge.cjs`: consented Claude status-line installation, allowlisting, composition, and rollback.
- `src/claudeTelemetryEnv.ts`, `src/providers/claudeOtel.ts`, `src/providers/claudeOtelReceiver.ts`, and `src/claudeTelemetrySetup.ts`: consented Claude OpenTelemetry metrics receiver (loopback-only), token-counter accumulation, environment-variable rollback, and the `mergeClaudeSnapshot` combiner in `src/providers/claude.ts`.
- `src/webview.ts`, `media/main.js`, and `media/styles.css`: restricted,
  read-only, on-demand usage-details editor panel.
- `src/statusBar.ts` and `src/extension.ts`: primary status-bar indicator, commands, and provider/setup picker.
- `.github/workflows/`: CI and private GitHub release automation.

## Gauge rules

1. Prefer eligible provider-reported quota windows according to the provider-independent selection policy and any explicit provider priority metadata.
2. Use bounded context usage only when no quota window is available.
3. Show unbounded token totals only as indeterminate/secondary information.
4. Never invent a limit, percentage, reset time, or zero value.
5. Keep the status-bar text concise, place compact detail in its hover, and put
   the full gauge and breakdown in the on-demand editor panel.
6. When one provider exposes two independent feeds, merge them inside that provider's own adapter through a pure function (never in the controller, which applies one adapter's snapshot as-is). The bounded, provider-reported feed always wins; an unbounded feed is a strict fallback and never displaces or is summed with it.

## Security invariants

- Require explicit consent before modifying Claude settings, starting provider processes, or making authenticated provider requests.
- Never read Claude or Codex credential files.
- Never read assistant transcripts to derive usage.
- Never log tokens, credentials, raw provider responses, account identifiers, prompts, source code, or filesystem paths.
- Spawn Codex directly without a shell. Use a shell for a pre-existing Claude status-line command only after explicit composition consent.
- Bound input size, output size, runtime, cancellation, and error text at every process boundary.
- Keep the webview CSP restrictive, scripts nonce-based, resources allowlisted,
  and the details panel free of webview-to-host commands unless a future
  feature strictly requires a validated message.
- Persist only provider choice, consent, and the minimum Claude rollback metadata. Keep usage history out of v1.
- Use only documented provider interfaces. Unsupported or missing data must remain visibly unavailable.
- Any local receiver must bind to `127.0.0.1` only, start only after explicit consent, and bound request body size, request/header timeouts, and connection count.
- Never trust a provider's own data-minimization flags to satisfy this project's privacy invariants. Verified against a real account (2026-09-16): Claude Code's OTLP exporter always attaches account email, user id, and organization id to every metric regardless of `OTEL_METRICS_INCLUDE_*` settings. Enforce allowlists for identifying fields at the parser, not the exporter.
- Writing another extension's settings requires modal consent, uses `ConfigurationTarget.Global` only for machine-scoped settings, preserves every entry it does not own, records exact rollback metadata, and never silently overwrites a value that changed since setup (warn and stop instead).

## Change requirements

- Add or update normalization tests for every provider payload change.
- Add tests for selection precedence whenever quota priority changes.
- Add a regression test covering both OTLP aggregation-temporality branches (DELTA-add vs. CUMULATIVE-replace) for every change to `src/providers/claudeOtel.ts`.
- Update `PRIVACY.md`, `SECURITY.md`, or `ACCURACY.md` whenever collection, process, network, or metric semantics change.
- Keep dependencies minimal, pinned where security-sensitive, and audited.
- Inspect packaged VSIX contents before every release.
- Scan the current workspace and full Git history for credentials, private keys, provider credential/snapshot files, and machine-specific user paths before every public release.
