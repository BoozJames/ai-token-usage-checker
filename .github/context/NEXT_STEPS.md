# Next Steps

Work from the top. Do not publish or weaken provider security boundaries to bypass a blocked integration.

## 1. Complete Claude validation

- Confirm `claude --version` is `2.1.251` or newer.
- Confirm Claude Code owns a valid CLI login; do not access or copy its credential storage.
- Run **AI Token Checker: Set Up Claude Code Bridge** and repair the bridge if it predates the absolute-Node command.
- Start a fresh Claude CLI session after setup, approve Claude's own status-line trust prompt if shown, and complete one assistant response.
- Confirm a snapshot appears, the 5-hour/7-day fields are normalized when the account provides them, and the view becomes ready.
- If this cannot be validated, keep Claude clearly labelled as requiring CLI authentication/status-line support in the public README; do not claim it works through browser login alone.

## 2. Prepare the Marketplace manifest

These actions require owner decisions before implementation:

- Confirm that `jamesbooz` is the Marketplace publisher ID or supply the correct immutable ID.
- Choose MIT or an explicit proprietary end-user license that permits Marketplace installation and use.
- Choose Preview or stable for the first public listing.
- Approve a neutral AI Token Checker listing icon that does not use provider trademarks as the extension's own logo.

After approval:

- Remove `private: true`.
- Add the selected license and align the `LICENSE` file.
- Add repository, homepage, issue tracker, pricing, gallery banner, icon, and preview metadata.
- Add `SUPPORT.md` and update README, SECURITY, PRIVACY, ACCURACY, and third-party notices for a public audience.
- Package each supported desktop target and inspect every VSIX before publishing.

## 3. Complete the Git branch flow

- Open a pull request from `feature/compact-top-gauge` to `develop`.
- Require CI and review before merge.
- Open a release pull request from `develop` to `master`.
- Tag the exact release commit on `master` as `vX.Y.Z`.
- Merge `master` back into `develop` after release.

Do not publish directly from the feature branch.

## 4. Configure secure Marketplace publishing

- Create or confirm the publisher in the Visual Studio Marketplace management portal.
- Configure a trusted GitHub publishing policy for this repository and the dedicated release workflow.
- Prefer `vsce publish --oidc`; do not add a long-lived Marketplace PAT to repository secrets.
- Give the publish job only `contents: read` and `id-token: write`.
- Trigger publishing only for a version tag whose commit is on `master` and whose version matches `package.json`.
- Publish the platform-specific VSIX files together and retain their SHA-256 checksums in the GitHub release.

## 5. Public-release verification

- Install each packaged target in a clean VS Code profile on its supported operating system.
- Verify consent, connect/disconnect, refresh throttling, provider switching, view movement, theme behavior, keyboard navigation, and disposal.
- Verify no background provider work occurs before consent.
- Verify uninstall/rollback removes only extension-owned Claude settings and files.
- Confirm the Marketplace page accurately states provider prerequisites and unsupported environments.

