# Current Status

Last verified: 2026-09-14 (Asia/Manila)

## Repository and release state

- Package: `ai-token-checker` version `1.0.3` is the current stable release.
- Marketplace publisher: `jamesbooz`; extension ID:
  `jamesbooz.ai-token-checker`.
- Repository default branch: `master`.
- Release commit: `0390428` on `master`; GitHub release and immutable tag
  `v1.0.3` were published on 2026-09-14.
- Version `1.0.1` restored the packaged official Copilot runtime because the
  external-CLI prerequisite introduced in `1.0.0` broke the prior no-setup
  Copilot experience.
- The release workflow builds GitHub release assets only. Automatic Marketplace
  publishing and its PAT/OIDC/Entra configuration have been removed; the owner
  will upload a checked VSIX manually.

## Validation

- The package intentionally includes the pinned `@github/copilot-sdk` client
  and downloads its three official x64 runtime artifacts during packaging.
- Local `npm run package` emits one untargeted universal x64 VSIX containing the
  Windows, Linux, and macOS runtimes for the Marketplace's manual upload field.
- Package validation enforces a 150 MB limit, requires all three runtime roots,
  rejects duplicate `node_modules`, and rejects source, tests, workflows,
  scripts, source maps, environment files, and credential files.
- `npm run package`, `npm run test:integration`, and `npm audit --audit-level=high`
  passed locally for v1.0.3. The package command includes
  lint, type checking, 23 unit tests, secret scanning, and a production build.
- `ai-token-checker-universal-x64.vsix` is 133.15 MB with 211
  files. Archive validation confirms stable untargeted metadata and all three
  pinned x64 runtime roots.
- The universal VSIX installs successfully in an isolated VS Code profile on
  Windows. All three runtime roots survive installation, and the packaged
  Windows runtime executable loads without a separate Copilot CLI.
- Local validation used Node.js 20.10.0 and emitted engine warnings because the
  supported minimum is Node.js 20.19.0. Release CI supplied the required
  supported-Node validation.
- Release workflow run `34820223790` passed tag verification, universal x64
  packaging, archive inspection, checksum generation, and GitHub release
  creation. The preceding feature and release pull-request CI runs also passed.

## User interface

- The bottom status-bar item remains the primary control. Its hover shows quota
  windows, reset times, token details, source, and freshness.
- The provider/action Quick Pick places the current provider first with its
  connection state and usage summary, then lists the other providers.
- Full usage details open in a single reusable editor tab on demand. The
  Activity Bar icon and permanent sidebar contribution have been removed.
- The Marketplace README includes a short generated GIF showing hover, provider
  selection, and the on-demand details tab without real account data.
- The Copilot CLI installation action and external executable setting have been
  removed because the runtime is packaged with the extension.
- The on-demand details tab remains read-only, with one responsive progress bar,
  quota windows, secondary token information, source, freshness, and errors.

## Privacy and security

- No telemetry or usage history is collected.
- The extension does not read provider credential files, prompts, transcripts,
  source code, or account identifiers.
- Provider activity remains consent-gated. Tokens and Copilot quota responses
  remain in memory and are never logged.
- The official packaged Copilot runtime is started by the pinned SDK client; no
  shell or user-managed Copilot executable is involved.

## Provider status

### Codex

- Uses the documented local `codex app-server` interface.
- Reads account rate limits and usage after explicit consent.
- Authentication remains owned by Codex; the extension never reads Codex
  credential files.

### GitHub Copilot

- Uses VS Code Authentication, the pinned official GitHub Copilot SDK client,
  and selects the current operating system's runtime from the universal x64 VSIX.
- Reads `account.getQuota`; it does not call undocumented Copilot endpoints.
- A real Copilot account still needs end-to-end validation with the restored
  packaged runtime.
- Fixed (2026-09-16) `normalizeCopilot()` skipping quota buckets on a
  `hasQuota` field that does not exist in the pinned SDK's own generated
  types (`@github/copilot-sdk@1.0.13`'s `AccountQuotaSnapshot`); the skip
  never fired, so a zero-entitlement bucket (e.g. Premium Interactions on
  Copilot Free) could render as a misleading "100% used" window. Now keys
  off the real `entitlementRequests === 0` field instead. Found and fixed
  by code review against the SDK's declared schema, no live account
  needed; see `NEXT_STEPS.md` for the still-open, account-dependent items.

### Claude Code

- Uses the documented Claude Code `statusLine` JSON bridge after explicit setup
  consent.
- The bridge allowlists quota percentages, reset times, and context-token
  metrics and does not read transcripts or Claude credentials.
- Claude Code `2.1.251` or newer is required for 5-hour and 7-day rate-limit
  fields.
- Investigated (2026-09-15) whether the graphical Claude Code VS Code
  extension panel (`claudeCode.useTerminal: false`) could supply quota data
  without the statusLine bridge. Inspecting the installed extension
  (`anthropic.claude-code`) confirmed it has no public command or API for
  usage data; its panel relays quota windows to its own webview only through
  a private internal channel, backed by an Anthropic-labeled
  `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET` SDK method.
  That is explicitly undocumented and unstable, so it must not be used.
  The statusLine bridge remains the only supported integration; it requires
  `claudeCode.useTerminal: true` because the panel never invokes statusLine.
- Surveyed (2026-09-15) 11 Marketplace extensions and several GitHub-only
  tools that report Claude Code/Claude.ai usage. 8 of 11 read the CLI's OAuth
  token out of `~/.claude/.credentials.json` or the OS keychain and poll the
  undocumented `api.anthropic.com/api/oauth/usage` endpoint directly; several
  also parse `~/.claude/projects/*.jsonl` transcripts for token/cost data.
  Only `Brainmetrix.claude-statusline` uses the same statusLine-to-cache-file
  pattern as this extension with no transcript or credential access.
  Anthropic's documented Usage & Cost / Analytics / Rate Limits APIs are
  Admin-API-key and organization-scoped, explicitly unavailable to individual
  accounts, so they cannot substitute for an individual session's quota
  bars. No surveyed alternative offers documented, credential-free, live
  individual-account quota data; the statusLine bridge remains the correct
  approach.
- Added (2026-09-16) a second, independent Claude data source using Claude
  Code's documented OpenTelemetry metrics export
  (`code.claude.com/docs/en/monitoring-usage`), specifically to reach panel-
  mode sessions (`claudeCode.useTerminal: false`, the extension's default),
  where the statusLine bridge never fires. "Enable Claude Code Telemetry"
  writes a fixed set of OTLP env vars into the official Claude extension's
  own documented `claudeCode.environmentVariables` setting (never
  `~/.claude/settings.json`, never a credential or transcript file) and
  starts a loopback-only (`127.0.0.1`) receiver that accumulates only the
  `claude_code.token.usage` counter. It surfaces an indeterminate session
  token total (`TokenUsage.scope === "session"`) as a strict fallback —
  the status line's quota windows and context-token usage always win when
  present, and no rate-limit percentage or reset time is ever synthesized
  from telemetry, because no such metric exists in this channel.
  `npm run check` (lint, typecheck, 54 unit tests including OTLP DELTA/
  CUMULATIVE temporality regression tests, secret scan, build) and
  `npm run test:integration` both pass.
- Validated (2026-09-16) end to end against a real account using the
  installed Claude Code CLI `2.1.273` directly (`claude -p "Reply with
  exactly: OK" --model fable`, with the exact env vars "Enable Claude Code
  Telemetry" writes, pointed at a temporary local capture listener instead
  of VS Code settings). The main `fable` request failed for this account
  (insufficient usage credits for that model), but Claude Code still made
  a successful internal `query_source: "auxiliary"` call on
  `claude-haiku-4-5-20251001` and exported real telemetry for it on
  process exit. Confirmed: the CLI flushes one OTLP export on exit without
  waiting for `OTEL_METRIC_EXPORT_INTERVAL`; every metric uses
  `aggregationTemporality: 1` (DELTA), matching this extension's add-not-
  replace handling; `claude_code.token.usage` data points carry `type` and
  `model` attributes exactly as parsed. **Also found and fixed a real
  privacy gap this same test surfaced:** Claude Code's exporter always
  attaches the account email, a user id, and an organization id to every
  metric, with no `OTEL_METRICS_INCLUDE_*` flag able to suppress them —
  contrary to what those flags are documented to do. `seriesKey()` in
  `src/providers/claudeOtel.ts` now allowlists only `type` and `model` when
  parsing, discarding every other attribute unread; replaying the real
  captured payload through the fixed parser confirmed a correct total
  (906 tokens) with zero identifying data in the result. The raw capture
  containing the real account email was deleted after verification; it was
  never committed. See `PRIVACY.md` and `ARCHITECTURE.md` for the corrected
  invariant.
- **Validated (2026-09-16) end to end against the real graphical panel**,
  closing the gap the CLI-only test above left open. Launched an isolated
  Extension Development Host (separate `--user-data-dir`, its own
  `--remote-debugging-port`, sharing only the machine's real installed
  extensions and Claude Code login) and drove it via Playwright's CDP
  connection: ran "AI Token Checker: Enable Claude Code Telemetry" for
  real (the actual command, writing the actual `claudeCode.
  environmentVariables` setting, not a substitute env var), opened the
  real Claude Code panel (`claudeCode.useTerminal: false`, the default,
  panel not terminal), and sent a real message answered by Sonnet 5. This
  caught and fixed one more real bug beyond the privacy gap above:
  `ClaudeAdapter.connect()` called `fs.watch()` on the extension's global
  storage directory before it necessarily existed — fine when the
  statusLine bridge had already created it, but `fs.watch` throws ENOENT
  synchronously on a first-ever telemetry-only setup with no prior bridge
  setup, which is exactly the panel-only user's situation. Fixed by
  `mkdirSync(..., {recursive:true})` before watching, wrapped defensively;
  regression test added in `test/unit/providers.test.ts`. After the fix,
  end to end confirmed: the receiver bound to port 41787 and stayed
  listening; the panel's real OTLP export landed at it; the mirrored
  snapshot file was written with a real total (44,004 tokens for that
  session); and the status-bar tooltip showed exactly `Session tokens` /
  `Tokens: Session 44,004` / `Claude Code telemetry` as designed. The
  isolated profile, all screenshots, and all throwaway automation scripts
  were deleted afterward; only the user's real, separate VS Code window
  was left running throughout. **This feature is now verified working
  end to end for both the terminal and the panel.**
- Closed the remaining two-concurrent-windows question (2026-09-16)
  without a second live session: `ClaudeAdapter.refresh()` reads the
  telemetry snapshot from disk unconditionally, never from its own
  receiver instance, so a window whose receiver loses the port-bind race
  is architecturally guaranteed to see another window's data. Proved with
  a deterministic unit test instead of repeating the costly live CDP
  session (`test/unit/providers.test.ts`, 56 unit tests total, `npm run
  check` passes).

## Marketplace readiness

- The manifest has stable `1.0.3` metadata, the confirmed publisher, MIT
  license, public repository/support links, free pricing, and a neutral icon.
- The v1.0.3 release is one x64 VSIX for Windows, Linux, and macOS. It has no
  target marker so the Marketplace can use it as a cross-platform fallback.
- Marketplace publication is manual from the existing publisher page using
  **More Actions → Update**.
- Release workflow run `34820223790` passed and published the universal VSIX
  plus its SHA-256 checksum.
- Do not move or recreate `v1.0.3`. Marketplace upload remains manual from the
  existing publisher page.
