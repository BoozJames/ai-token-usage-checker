# Next Steps

Work from the top. Do not publish or weaken provider security boundaries to
bypass a blocked integration.

## 1. Review and merge the release-output reference fix

- Review pull request #17 from `bugfix/release-output-reference` into `develop`.
- Confirm its latest-head CI checks are green, then merge it.
- Open a release pull request from `develop` into `master`.
- Merge the output-reference fix into `master`; do not create another version
  tag.

Do not publish directly from the feature branch.

## 2. Complete real-provider validation

- Install the official GitHub Copilot CLI separately, connect Copilot through the
  status-bar Quick Pick, and verify `account.getQuota` with a real account.
- Confirm the supported SDK/CLI response matches the extension's provider and
  source labels. Do not infer dashboard-only metrics.
- Confirm Claude Code owns a valid CLI login, start a fresh Claude CLI session
  after bridge setup, and complete one assistant response.
- Verify Claude 5-hour/7-day fields when the account reports them. A browser-only
  Claude login is not a supported substitute for Claude CLI authentication.
- Never capture provider responses, tokens, account identifiers, user paths,
  prompts, transcripts, or source code in fixtures, issues, screenshots, or this
  context directory.

## 3. Clean-profile acceptance testing

- Install `ai-token-checker.vsix` in clean VS Code profiles on Windows, macOS,
  and Linux.
- Verify the status-bar Quick Pick, provider switching, consent, connect and
  disconnect, refresh throttling, read-only sidebar details, view movement,
  themes, keyboard navigation, accessibility, and disposal.
- Verify no provider work occurs before consent.
- Verify uninstall and rollback remove only extension-owned Claude settings and
  files.

## 4. Recover `v1.0.0` Marketplace publishing

- After the recovery reaches `master`, open **Actions → Release → Run workflow**
  from `master`, enter existing tag `v1.0.0`, and run it.
- Confirm the existing GitHub release retains the three VSIX files and SHA-256
  checksums, and confirm the Marketplace publishing job succeeds.
- Do not delete, move, or recreate tag `v1.0.0`.
- Keep the existing `v0.3.0` tag unchanged. Use the documented manual recovery
  only if the missing preview GitHub release is still wanted.

## 5. Configure secure Marketplace publishing

- Configure Visual Studio Marketplace trusted publishing for this repository and
  `.github/workflows/release.yml`.
- Use `vsce publish --oidc`; do not add a long-lived Marketplace PAT to repository
  secrets.
- Set `VSCE_PUBLISH_ENABLED` to `true` only after the trusted policy is active.
- Publish only a version tag whose commit is on `master` and whose version matches
  `package.json`.
- Confirm the Marketplace page accurately states provider prerequisites,
  privacy boundaries, metric limitations, and unsupported environments.
