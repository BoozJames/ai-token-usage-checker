# Contributing

## Branches

- `master` contains release-ready code and accepts changes by pull request.
- `develop` is the integration branch.
- Create `feature/<slug>` or `bugfix/<slug>` from `develop` and open a pull request back to `develop`.
- Release with a `develop` to `master` pull request, tag `vX.Y.Z`, then merge `master` back into `develop`.

Do not commit directly to protected branches.

## Required checks

```text
npm ci
npm run check
npm run test:integration
npm audit
npm run package
```

New providers must implement the adapter contract, remain disabled until consent, avoid credential/transcript access, document their source and limitations, and fail closed when a metric is absent or malformed.

## Project orientation

Read `.github/context/README.md` and its linked architecture and status files
before changing provider behavior. User instructions belong in `README.md`;
implementation, testing, and branch details belong here or in `PUBLISHING.md`.

The extension bundles TypeScript and the Copilot SDK's JavaScript client with
esbuild. It deliberately does not package the Copilot CLI native runtime.
Copilot changes must continue to use the documented SDK interface and a
separately installed official CLI.

## Local development

Requires Node.js 20.19+ and VS Code 1.95+:

```text
npm ci
npm run check
npm run test:integration
npm audit
npm run package
```

Press `F5` in VS Code to launch the Extension Development Host. Never use real
credentials, prompts, transcripts, account identifiers, or raw provider
responses in tests, fixtures, logs, issues, or documentation.
