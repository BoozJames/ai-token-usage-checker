# Current Status

Last verified: 2026-09-11 (Asia/Manila)

## Repository and release state

- Package: `ai-token-checker` version `0.3.0`, prepared as a Marketplace pre-release and Preview listing.
- The Marketplace publisher ID in the manifest has been confirmed by the owner.
- Repository default branch: `master`.
- Active work branch: `feature/compact-top-gauge`.
- The implementation has been merged through pull requests into `develop` and
  `master`. The feature branch now contains the unmerged `0.3.0` public-preview
  readiness changes and has been synchronized with `develop`. Verify live
  branch relationships with Git rather than recording volatile counts here.
- The GitHub repository is public.
- No VS Code Marketplace release has been published yet.
- The exact Marketplace extension ID `jamesbooz.ai-token-checker` had no match when checked on 2026-09-11, but availability is not reserved until publication.
- Tag `v0.3.0` exists on `master`. Its three native build jobs passed, but the
  GitHub release job failed because the GitHub CLI was asked to infer a
  repository without a checkout. No GitHub release was created by that run.

## Validation

The current feature branch passed on 2026-09-11:

- ESLint and strict TypeScript checks.
- 20 unit tests.
- Secret scanning.
- Production build.
- VS Code Extension Host smoke test.
- Dependency audit with zero reported vulnerabilities.
- Marketplace pre-release packaging for Windows x64, including manifest and
  packaged-content inspection.

A workspace and full-history sensitive-data audit on 2026-09-11 found no credential-shaped secrets, private keys, bearer tokens, JWTs, provider credential/snapshot files, or machine-specific user paths. CI uses the repository scanner against full Git history; this is a preventive check, not permission to place secrets in the repository temporarily.

The platform-specific Windows VSIX is approximately 44 MB because the official Copilot SDK includes a native runtime. Linux and macOS builds are produced in CI on their native runners.

## User interface

- One responsive progress bar represents the selected provider's primary active quota.
- The sidebar lists all reported quota windows and secondary token totals as text.
- The bottom status item stays compact and opens a provider/action Quick Pick.
- The editor-title command appears only where VS Code permits editor-title actions.
- Provider picker artwork is referenced from installed official provider extensions, with VS Code theme-icon fallbacks; provider artwork is not redistributed.

## Provider status

### Codex

- Uses the documented local `codex app-server` interface.
- Reads account rate limits and usage after explicit consent.
- Provider-reported 5-hour and weekly windows drive the gauge; lifetime tokens are secondary detail.
- Authentication remains owned by Codex; the extension never reads Codex credential files.

### GitHub Copilot

- Uses VS Code Authentication and the pinned official GitHub Copilot SDK.
- Reads `account.getQuota`; it does not call undocumented Copilot endpoints.
- Chat and premium quota windows outrank inline-suggestion quota on the primary gauge.
- Runtime usage counts are preferred when the SDK returns a reset timestamp inconsistent with a populated current quota.
- The native Copilot dashboard can expose newer metrics that the supported SDK response does not provide. Those values must remain unavailable rather than inferred.

### Claude Code

- Uses the documented Claude Code `statusLine` JSON bridge after explicit setup consent.
- The bridge allowlists quota percentages, reset times, and context-token metrics and does not read transcripts or Claude credentials.
- Setup uses an absolute Node.js executable, supports composition with an existing status-line command, and supports rollback.
- Claude Code `2.1.251` or newer is required for 5-hour and 7-day rate-limit fields.
- End-to-end real-account validation remains incomplete. A locally authenticated Claude Code CLI session must generate at least one assistant response before a snapshot exists.
- A claude.ai browser session cannot be imported by this extension. Claude CLI authentication must remain entirely owned by Claude.

## Marketplace readiness

- The manifest no longer has a private flag and now contains the confirmed
  publisher, MIT license, public repository/support links, free pricing, Preview
  metadata, and a neutral 256×256 PNG listing icon.
- README, security support, third-party notices, changelog, and publishing
  guidance have public-preview wording.
- CI and release packaging mark VSIX files as Marketplace pre-releases.
- The tag workflow verifies the tag is on `master` and matches `package.json`,
  builds x64 packages on each native operating system, creates checksums, and
  creates a GitHub pre-release.
- Optional Marketplace publishing uses OIDC and remains disabled until trusted
  publishing is configured and the repository variable is enabled.
- The release workflow supports a validated manual recovery run for an existing
  tag and passes the repository explicitly to the GitHub CLI.
- GitHub release recovery is blocked only on merging the workflow fix through
  the required pull requests. Marketplace publishing remains separately blocked
  on trusted-publishing configuration. Do not publish from a working branch.
