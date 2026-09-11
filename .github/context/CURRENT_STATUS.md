# Current Status

Last verified: 2026-09-11 (Asia/Manila)

## Repository and release state

- Package: `ai-token-checker` version `0.4.0`, prepared as the first stable release.
- The Marketplace publisher ID is `jamesbooz`; the extension ID is
  `jamesbooz.ai-token-checker`.
- Repository default branch: `master`.
- Active work branch: `feature/status-bar-first`, created from `develop`.
- Pull request #7 targets `develop` from `feature/status-bar-first` and is awaiting
  CI and review.
- The GitHub repository is public. No VS Code Marketplace release has been
  published yet.
- Tag `v0.3.0` remains the preview tag. Its original release run built all three
  native packages but failed while creating the GitHub release. The recovery
  workflow is retained; do not move or recreate that tag.
- Version `0.4.0` must be merged through pull request #7 into `develop`, then
  through a release pull request into `master`, before tagging.

## Validation

The current feature branch passed on 2026-09-11:

- ESLint and strict TypeScript checks.
- 20 unit tests.
- Full-history secret scanning.
- Production build.
- VS Code Extension Host smoke test.
- Dependency audit with zero reported vulnerabilities.
- Stable VSIX packaging and packaged-content inspection.
- GitHub Actions YAML parsing.

The stable VSIX is about 74 KB and contains 17 files. It excludes
`node_modules`, source, tests, development configuration, workflows, scripts,
source maps, environment files, and credential files. It has no Marketplace
pre-release flag.

The full official GitHub Copilot CLI runtime is no longer redistributed. The
pinned Copilot SDK JavaScript client is compiled into the extension bundle, and
the extension connects to a separately installed official Copilot CLI.

## User interface

- The bottom status-bar item is the primary, always-visible control. Selecting it
  opens the provider/action Quick Pick.
- The Quick Pick selects providers, connects or disconnects, refreshes, opens
  details and settings, manages the Claude bridge, and links to Copilot CLI setup.
- The low-visibility editor-title action has been removed.
- The sidebar is a read-only details view with one responsive progress bar,
  reported quota windows, secondary token information, source, freshness, and
  errors. Persistent setup/action buttons are no longer shown there.
- Provider picker artwork is referenced from installed official provider
  extensions, with VS Code theme-icon fallbacks; provider artwork is not
  redistributed.

## Privacy and security

- No telemetry or usage history is collected.
- The extension does not read provider credential files, prompts, transcripts,
  source code, or account identifiers.
- Provider processes are spawned directly without a shell and only after consent.
- The extension no longer creates an output channel or logs raw Copilot quota
  responses. Authentication tokens and snapshots remain in memory only.
- Claude's bridge writes only allowlisted usage metrics to extension-owned local
  storage and can be removed through the status-bar Quick Pick.

## Provider status

### Codex

- Uses the documented local `codex app-server` interface.
- Reads account rate limits and usage after explicit consent.
- Provider-reported 5-hour and weekly windows drive the gauge; lifetime tokens
  remain secondary detail.
- Authentication remains owned by Codex; the extension never reads Codex
  credential files.

### GitHub Copilot

- Uses VS Code Authentication, the pinned official GitHub Copilot SDK client,
  and a separately installed official GitHub Copilot CLI.
- Reads `account.getQuota`; it does not call undocumented Copilot endpoints.
- Supported bounded quota windows drive the gauge. Metrics visible only in the
  native Copilot dashboard remain unavailable rather than inferred.
- The external-CLI packaging change passed build and activation checks. A real
  Copilot account still needs end-to-end validation with the official CLI
  installed.

### Claude Code

- Uses the documented Claude Code `statusLine` JSON bridge after explicit setup
  consent.
- The bridge allowlists quota percentages, reset times, and context-token metrics
  and does not read transcripts or Claude credentials.
- Setup uses an absolute Node.js executable, supports composition with an
  existing status-line command, and supports rollback.
- Claude Code `2.1.251` or newer is required for 5-hour and 7-day rate-limit
  fields.
- A claude.ai browser session cannot be imported. Claude CLI authentication is
  owned entirely by Claude Code, and at least one assistant response must occur
  after bridge setup before a snapshot exists.

## Marketplace readiness

- The manifest has the confirmed publisher, MIT license, public repository and
  support links, free pricing, a neutral 256x256 icon, and stable `0.4.0`
  metadata.
- README is user-focused; contributor and release details live in
  `CONTRIBUTING.md` and `PUBLISHING.md`.
- CI enforces a maximum 10 MB VSIX and validates its contents. The current package
  is about 74 KB.
- The tag workflow verifies that a tag is on `master` and matches
  `package.json`, builds packages on the supported operating systems, creates
  checksums, and creates a GitHub release.
- Optional Marketplace publishing uses OIDC and remains disabled until trusted
  publishing is configured and the repository variable is enabled.
- Do not publish or tag `v0.4.0` from the feature branch.
