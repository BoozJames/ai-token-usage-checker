# Next Steps

Work from the top. Preserve the documented provider security boundaries.

## 1. Validate the bundled Copilot runtime release

- Confirm CI passes with the repository's supported Node.js version. Local
  `npm ci`, `npm run package`, `npm run test:integration`, and audit validation
  already pass, and the generated Windows archive has been inspected.
- Install the Windows package in a clean VS Code profile and verify Copilot
  connects without a separately installed `copilot` executable.
- Confirm uninstall removes the packaged runtime with the extension and does not
  leave an SDK runtime cache.

## 2. Complete real-provider validation

- Verify `account.getQuota` with a real Copilot account using only the packaged
  runtime and confirm source labels remain accurate.
- Confirm Claude Code owns a valid CLI login, start a fresh Claude CLI session
  after bridge setup, and complete one assistant response.
- Never capture provider responses, tokens, account identifiers, user paths,
  prompts, transcripts, or source code in fixtures, issues, screenshots, or this
  context directory.

## 3. Clean-profile acceptance testing

- Test the matching VSIX on Windows, macOS, and Linux x64.
- Verify provider switching, consent, connect/disconnect, refresh throttling,
  read-only details, themes, keyboard navigation, accessibility, and disposal.
- Verify no provider work occurs before consent.

## 4. Release and manually upload `v1.0.1`

- Merge this feature through `develop` and `master` after review and green CI.
- Tag the promoted `master` commit as `v1.0.1`; do not move existing tags.
- Confirm the GitHub release contains the three target-specific VSIX files and
  checksums.
- Upload the required target package manually from publisher `jamesbooz` using
  **More Actions → Update**.

## 5. Keep Marketplace publishing manual

- Do not add Marketplace PAT, OIDC, or Entra credentials to the repository.
- Use `npm ci` followed by `npm run package` for a checked local VSIX matching
  the current supported x64 operating system.
- Confirm the Marketplace page accurately states provider prerequisites,
  privacy boundaries, metric limitations, and supported platforms.
