# Next Steps

Work from the top. Preserve the documented provider security boundaries.

## 1. Validate the universal Copilot runtime package

- CI Node.js version — **closed**: `.github/workflows/ci.yml` and
  `release.yml` pin `20.19.0`, matching `package.json` engines; release
  run `34820223790` passed with it.
- Verify Copilot connects from the installed universal VSIX with a real account
  and no separately installed `copilot` executable. **Still blocked on a real
  Copilot account** — none is available on this machine.
- Uninstall leaving no SDK runtime cache — **closed by code review
  (2026-09-16)**: `CopilotAdapter.connect()` always constructs `CopilotClient`
  with an explicit `connection: RuntimeConnection.forStdio({ path: runtimePath
  })` pointing at the bundled runtime inside the extension's own install
  directory. The SDK's own cache-download path
  (`@github/copilot-sdk`'s `runtimeArtifacts.js`, `defaultRuntimeCacheRoot()`
  under `%LOCALAPPDATA%/github-copilot-sdk/runtime` or platform equivalent)
  only runs for the no-connection fallback case, which this code never
  reaches. `detect()`/`connect()` do no filesystem writes before that point
  beyond `chmodSync` on already-bundled files. No cache directory outside
  the extension's own folder is ever created, so uninstalling the extension
  removes everything.

## 2. Complete real-provider validation

- Fixed (2026-09-16) a real bug found by code review against the pinned
  `@github/copilot-sdk@1.0.13`'s own generated types
  (`AccountQuotaSnapshot`, marked `@experimental`): `normalizeCopilot()` in
  `src/providers/copilot.ts` skipped a quota bucket on `quota.hasQuota ===
  false`, but `hasQuota` does not exist anywhere in the SDK's declared
  schema (confirmed directly against `node_modules/@github/copilot-sdk/
  dist/generated/rpc.d.ts`) and is not part of its public export map, so
  that condition could never be true and the skip never fired. Net effect:
  a bucket the account has zero entitlement for (e.g. Premium Interactions
  on Copilot Free) would render as "100% used" instead of being hidden.
  Replaced with the real, schema-confirmed signal, `entitlementRequests ===
  0` (distinct from `-1`, unlimited, already handled separately). Test
  fixtures using the fictitious `hasQuota` field were corrected; a new test
  confirms a bucket is not falsely skipped when `entitlementRequests` is
  merely absent (older/partial responses). `npm run check` (57 unit tests)
  passes. This was verifiable entirely through code review against the
  SDK's own type declarations — it did not need a live account.
- Verify `account.getQuota` with a real Copilot account using only the packaged
  runtime and confirm source labels remain accurate — **still blocked on a
  real Copilot account** to observe actual wire responses end to end (the
  fix above is verified against the SDK's declared schema, not a live
  response).
- Confirm Claude Code owns a valid CLI login, start a fresh Claude CLI session
  after bridge setup, and complete one assistant response.
- Claude telemetry (both terminal-CLI and graphical-panel launch paths) is
  now verified end to end against a real account (2026-09-16,
  `CURRENT_STATUS.md`) — no further action needed on the core path.
  The two-concurrent-windows sharing case is closed without a second live
  session: `ClaudeAdapter.refresh()` always reads the telemetry snapshot
  from disk unconditionally, never from `this.receiver` directly, so a
  window whose own receiver lost the port-bind race is architecturally
  guaranteed to see whatever total another window's receiver wrote. A
  deterministic unit test (`test/unit/providers.test.ts`, "shares a
  telemetry total across windows...") pre-writes the shared file and
  constructs an adapter with `createReceiver: () => undefined` to model
  the losing window, confirming `refresh()` still returns the correct
  merged snapshot. This was preferred over repeating the expensive live
  CDP session for a case the existing bind-conflict and file-read tests
  already cover independently. Only with real usage data to look at
  should `claude_code.cost.usage` or other OTel metrics be considered for
  a future iteration.
- Never capture provider responses, tokens, account identifiers, user paths,
  prompts, transcripts, or source code in fixtures, issues, screenshots, or this
  context directory.

## 3. Clean-profile acceptance testing

- Test the same universal VSIX on Windows, macOS, and Linux x64.
- Verify provider switching, consent, connect/disconnect, refresh throttling,
  read-only details, themes, keyboard navigation, accessibility, and disposal.
- Verify no provider work occurs before consent.

## 4. Manually upload `v1.0.3`

- The universal package is merged, tagged, and published in the GitHub v1.0.3
  release. Keep the v1.0.3 tag immutable.
- Upload `ai-token-checker-universal-x64.vsix` manually from publisher `jamesbooz` using
  **More Actions → Update**.

## 5. Keep Marketplace publishing manual

- Do not add Marketplace PAT, OIDC, or Entra credentials to the repository.
- Use `npm ci` followed by `npm run package` for the checked universal x64 VSIX.
- Confirm the Marketplace page accurately states provider prerequisites,
  privacy boundaries, metric limitations, and supported platforms.
