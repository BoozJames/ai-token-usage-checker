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

### Claude Code

- Uses the documented Claude Code `statusLine` JSON bridge after explicit setup
  consent.
- The bridge allowlists quota percentages, reset times, and context-token
  metrics and does not read transcripts or Claude credentials.
- Claude Code `2.1.251` or newer is required for 5-hour and 7-day rate-limit
  fields.

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
