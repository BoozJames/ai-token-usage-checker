# Current Status

Last verified: 2026-09-11 (Asia/Manila)

## Repository and release state

- Package: `ai-token-checker` version `0.1.8`.
- Publisher value in the manifest: `jamesbooz`; Marketplace publisher ownership is not yet confirmed.
- Repository default branch: `master`.
- Active work branch: `feature/compact-top-gauge`.
- The feature branch contains the current unmerged implementation; `develop` and `master` currently point to the same older base. Verify the live ahead/behind count with Git rather than recording a volatile number here.
- The GitHub repository is public.
- No VS Code Marketplace release has been published.
- The exact Marketplace extension ID `jamesbooz.ai-token-checker` had no match when checked on 2026-09-11, but availability is not reserved until publication.

## Validation

The current feature branch passed on 2026-09-11:

- ESLint and strict TypeScript checks.
- 20 unit tests.
- Secret scanning.
- Production build.
- VS Code Extension Host smoke test.
- Dependency audit with zero reported vulnerabilities.

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

The code is not ready to publish to the Marketplace until all items below are resolved:

- Remove the manifest's `private` flag for the public release.
- Confirm the immutable Marketplace publisher ID.
- Choose a public-use license. The current proprietary license prohibits the use/distribution expected by a public listing.
- Add `repository`, `homepage`, `bugs`, and public support metadata.
- Add a dedicated PNG Marketplace icon of at least 128×128 pixels; keep the SVG only for VS Code UI contributions.
- Rewrite private-release wording in README and security support policy.
- Decide whether the first listing is Preview or stable.
- Merge through `feature` → `develop` → `master` by pull request before tagging.
- Add Marketplace trusted publishing only after the publisher and release policy are confirmed.
