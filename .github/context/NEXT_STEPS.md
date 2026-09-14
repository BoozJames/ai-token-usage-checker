# Next Steps

Work from the top. Preserve the documented provider security boundaries.

## 1. Validate the universal Copilot runtime package

- Confirm CI passes with the repository's supported Node.js version. Local
  packaging, integration, audit, archive inspection, and isolated VSIX
  installation already pass on Windows.
- Verify Copilot connects from the installed universal VSIX with a real account
  and no separately installed `copilot` executable.
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
