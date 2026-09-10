# Publishing

AI Token Checker uses the repository branch policy in `CONTRIBUTING.md`. Do not
tag or publish a commit directly from a feature branch.

## First public preview

1. Open and merge a pull request from `feature/compact-top-gauge` to `develop`
   after CI and review pass.
2. Open and merge a release pull request from `develop` to `master`.
3. Confirm that `package.json` contains version `0.3.0`, publisher
   `jamesbooz`, and `preview: true`.
4. Create and push the annotated tag from the exact `master` commit:

   ```text
   git switch master
   git pull --ff-only origin master
   git tag -a v0.3.0 -m "AI Token Checker 0.3.0 public preview"
   git push origin v0.3.0
   ```

The `Release` GitHub Actions workflow verifies that the tag is on `master` and
matches `package.json`, builds Windows, Linux, and macOS x64 pre-release VSIX
files, creates SHA-256 checksums, and attaches them to a GitHub pre-release.

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

The job requests only `contents: read` and `id-token: write` and runs
`vsce publish --oidc`. Do not add a Marketplace PAT to the repository.

The first Marketplace upload is a pre-release. VS Code Marketplace versions
must use `major.minor.patch`; suffixes such as `-alpha` are not supported. This
project uses odd minor versions (`0.3.x`) for previews and reserves the next
even minor line (`0.4.x`) for a stable release.

## Recovering a failed release job

If a tag-triggered run builds successfully but fails before creating its GitHub
release, first merge the workflow fix through `develop` and `master`. Then open
**Actions → Release → Run workflow**, enter the existing tag such as `v0.3.0`,
and run it from `master`. The workflow checks out and validates the tagged
source, rebuilds its platform packages, and creates the missing release. Do not
move or recreate an existing release tag.
