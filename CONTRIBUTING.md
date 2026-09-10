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
