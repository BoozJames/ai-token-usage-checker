# Current Status

Last verified: 2026-09-14 (Asia/Manila)

## Repository and release state

- Package: `ai-token-checker` version `1.0.2` is in development.
- Marketplace publisher: `jamesbooz`; extension ID:
  `jamesbooz.ai-token-checker`.
- Repository default branch: `master`.
- Active work branch: `feature/status-hover-details`, created from
  `origin/develop`.
- GitHub releases and immutable tags through `v1.0.1` remain unchanged.
- Version `1.0.1` restored the packaged official Copilot runtime because the
  external-CLI prerequisite introduced in `1.0.0` broke the prior no-setup
  Copilot experience.
- The release workflow builds GitHub release assets only. Automatic Marketplace
  publishing and its PAT/OIDC/Entra configuration have been removed; the owner
  will upload a checked VSIX manually.

## Validation

- The package intentionally includes the pinned `@github/copilot-sdk` production
  dependency and its matching native x64 runtime.
- Local `npm run package` detects Windows, Linux, or macOS x64 and emits a
  target-specific VSIX rather than a misleading universal package.
- CI and release packaging pin the macOS x64 job to GitHub's
  `macos-15-intel` runner. `macos-latest` is arm64 and installs an arm64 native
  dependency that cannot satisfy a `darwin-x64` package.
- Package validation enforces a 150 MB limit, requires the matching runtime,
  permits only the SDK's expected production dependency tree, and rejects
  source, tests, workflows, scripts, source maps, environment files, and
  credential files.
- `npm ci`, `npm run package`, `npm run test:integration`, and
  `npm audit --audit-level=high` pass locally. The package command includes
  lint, type checking, 22 unit tests, secret scanning, and a production build.
- `ai-token-checker-win32-x64.vsix` is 44.00 MB with 782 files. Archive
  validation confirms stable metadata, the `win32-x64` target, and the matching
  packaged runtime.
- Local validation used Node.js 20.10.0 and emitted engine warnings because the
  supported minimum is Node.js 20.19.0. CI remains the required supported-Node
  validation.

## User interface

- The bottom status-bar item remains the primary control. Its hover shows quota
  windows, reset times, token details, source, and freshness.
- The provider/action Quick Pick places the current provider first with its
  connection state and usage summary, then lists the other providers.
- Full usage details open in a single reusable editor tab on demand. The
  Activity Bar icon and permanent sidebar contribution have been removed.
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
  and the packaged platform-specific official Copilot runtime.
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

- The manifest has stable `1.0.2` metadata, the confirmed publisher, MIT
  license, public repository/support links, free pricing, and a neutral icon.
- Each VSIX is platform-specific because it contains a native Copilot runtime.
- Marketplace publication is manual from the existing publisher page using
  **More Actions → Update**.
- Do not move or recreate existing tags. Create `v1.0.2` only after the change is
  reviewed, promoted to `master`, and validated.
