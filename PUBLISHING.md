# Publishing

AI Token Checker uses the repository branch policy in `CONTRIBUTING.md`. Do not
tag or publish a commit directly from a feature branch.

## First stable release

1. Open and merge the version-bump pull request into `develop` after CI and
   review pass.
2. Open and merge a release pull request from `develop` to `master`.
3. Confirm that `package.json` contains version `1.0.0`, publisher
   `jamesbooz`, and no Preview flag.
4. Create and push the annotated tag from the exact `master` commit:

   ```text
   git switch master
   git pull --ff-only origin master
   git tag -a v1.0.0 -m "AI Token Checker 1.0.0"
   git push origin v1.0.0
   ```

The `Release` GitHub Actions workflow verifies that the tag is on `master` and
matches `package.json`, builds Windows, Linux, and macOS x64 VSIX files, creates
SHA-256 checksums, and attaches them to a GitHub release.

Afterward, merge `master` back into `develop` through a pull request.

## Marketplace trusted publishing

The Marketplace publishing job is disabled unless the repository variable
`VSCE_PUBLISH_ENABLED` is exactly `true`.

Before enabling it:

1. In the Visual Studio Marketplace publisher portal, select publisher
   `jamesbooz` and configure trusted publishing for GitHub repository
   `BoozJames/ai-token-usage-checker` and workflow
   `.github/workflows/release.yml`.
2. In GitHub, add the Actions repository variable `VSCE_PUBLISH_ENABLED` with
   value `true`.
3. Confirm the extension name and display name are still available immediately
   before the first publish.

The job requests only `contents: read` and `id-token: write`. It pins the exact
official `@vscode/vsce@3.9.3-12` prerelease because the current stable `3.9.2`
does not yet recognize `--oidc`. Replace that pin with a stable VSCE version as
soon as trusted publishing is included in a stable release. Do not add a
Marketplace PAT to the repository.

VS Code Marketplace versions must use `major.minor.patch`; suffixes such as
`-alpha` are not supported. Stable releases follow semantic versioning from
`1.0.0`; Marketplace pre-release status is controlled by the packaging flag,
not an odd/even minor-version convention.

## Recovering a failed release job

If a tag-triggered run fails after building, first merge the workflow fix through
`develop` and `master`. Then open **Actions → Release → Run workflow**, enter the
existing tag, and run it from `master`. The workflow checks out and validates the
tagged source, rebuilds its platform packages, creates a missing release or
replaces assets on an existing release, and retries Marketplace publishing. Do
not move or recreate an existing release tag.
