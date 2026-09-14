# Publishing

AI Token Checker uses the repository branch policy in `CONTRIBUTING.md`. Do not
tag or publish a commit directly from a feature branch.

## Release process

1. Open and merge the version-bump pull request into `develop` after CI and
   review pass.
2. Open and merge a release pull request from `develop` to `master`.
3. Confirm that `package.json` contains the intended version, publisher
   `jamesbooz`, and no Preview flag.
4. Create and push the annotated tag from the exact `master` commit:

   ```text
   git switch master
   git pull --ff-only origin master
   git tag -a vX.Y.Z -m "AI Token Checker X.Y.Z"
   git push origin vX.Y.Z
   ```

The `Release` GitHub Actions workflow verifies that the tag is on `master` and
matches `package.json`, builds the universal x64 VSIX, creates its SHA-256
checksum, and attaches both files to a GitHub release. It does not publish to
the VS Code Marketplace.

Afterward, merge `master` back into `develop` through a pull request.

## Manual Marketplace publishing

No Marketplace PAT, OIDC credential, Microsoft Entra identity, or automatic
Marketplace publishing job is used by this repository.

For a local package on a supported x64 development machine:

```text
npm ci
npm run package
```

The package command runs all checks and creates
`ai-token-checker-universal-x64.vsix`. It downloads the pinned official Copilot
runtimes for Windows, Linux, and macOS x64 into a disposable staging directory;
the downloaded files are never added to the working tree. Upload the resulting
VSIX from the existing extension's **More Actions → Update** page under
publisher `jamesbooz`. Do not use **New extension** for an update.

The package is universal across the three supported desktop operating systems,
but it is x64-only. It is intentionally not marked with a Marketplace target,
allowing the manual portal's single upload field to accept it as the fallback
package.

VS Code Marketplace versions must use `major.minor.patch`; suffixes such as
`-alpha` are not supported. Stable releases follow semantic versioning from
`1.0.0`; Marketplace pre-release status is controlled by the packaging flag,
not an odd/even minor-version convention.

## Recovering a failed GitHub release job

If a tag-triggered run fails after building, first merge the workflow fix through
`develop` and `master`. Then open **Actions → Release → Run workflow**, enter the
existing tag, and run it from `master`. The workflow checks out and validates the
tagged source, rebuilds its platform packages, and creates a missing GitHub
release or replaces its assets. Marketplace upload remains manual. Do not move
or recreate an existing release tag.

Manual recovery passes the requested tag through `RELEASE_TAG`. Do not attempt to
override GitHub's reserved `GITHUB_REF_NAME`, which remains the selected workflow
branch during `workflow_dispatch`.

If GitHub does not submit the optional manual tag field, the workflow derives
`v<package version>` from the selected branch. It still requires an exact semantic
version tag, verifies that the tag exists and is on `master`, and checks that the
tagged package version matches before building or publishing.
