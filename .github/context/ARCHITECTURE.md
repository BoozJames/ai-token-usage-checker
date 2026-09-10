# Architecture and Invariants

## Primary components

- `src/model.ts`: normalized provider snapshot model and gauge-selection rules.
- `src/controller.ts`: consent, provider lifecycle, refresh scheduling, stale-state handling, and persistence.
- `src/providers/`: Claude, Codex, and Copilot adapters.
- `src/claudeSetup.ts` and `resources/claude-bridge.cjs`: consented Claude status-line installation, allowlisting, composition, and rollback.
- `src/webview.ts`, `media/main.js`, and `media/styles.css`: restricted webview and detailed sidebar UI.
- `src/statusBar.ts` and `src/extension.ts`: native VS Code indicators, commands, and provider picker.
- `.github/workflows/`: CI and private GitHub release automation.

## Gauge rules

1. Prefer eligible provider-reported quota windows according to the provider-independent selection policy and any explicit provider priority metadata.
2. Use bounded context usage only when no quota window is available.
3. Show unbounded token totals only as indeterminate/secondary information.
4. Never invent a limit, percentage, reset time, or zero value.
5. Keep all reported detail in the sidebar; keep the status bar concise.

## Security invariants

- Require explicit consent before modifying Claude settings, starting provider processes, or making authenticated provider requests.
- Never read Claude or Codex credential files.
- Never read assistant transcripts to derive usage.
- Never log tokens, credentials, raw provider responses, account identifiers, prompts, source code, or filesystem paths.
- Spawn Codex directly without a shell. Use a shell for a pre-existing Claude status-line command only after explicit composition consent.
- Bound input size, output size, runtime, cancellation, and error text at every process boundary.
- Keep the webview CSP restrictive, scripts nonce-based, messages validated, and resources allowlisted.
- Persist only provider choice, consent, and the minimum Claude rollback metadata. Keep usage history out of v1.
- Use only documented provider interfaces. Unsupported or missing data must remain visibly unavailable.

## Change requirements

- Add or update normalization tests for every provider payload change.
- Add tests for selection precedence whenever quota priority changes.
- Update `PRIVACY.md`, `SECURITY.md`, or `ACCURACY.md` whenever collection, process, network, or metric semantics change.
- Keep dependencies minimal, pinned where security-sensitive, and audited.
- Inspect packaged VSIX contents before every release.

