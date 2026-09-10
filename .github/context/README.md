# Project Context

This directory is the shared, tool-neutral source of truth for AI Token Checker. Copilot, Codex, Claude, and other coding assistants should read these files before proposing or making changes.

Read in this order:

1. [CURRENT_STATUS.md](CURRENT_STATUS.md) — verified implementation and release state.
2. [NEXT_STEPS.md](NEXT_STEPS.md) — prioritized work and decisions still required.
3. [ARCHITECTURE.md](ARCHITECTURE.md) — integration boundaries and security invariants.

## Maintenance rules

- Update `CURRENT_STATUS.md` after a material feature, provider behavior change, release, or completed validation run.
- Move completed work out of `NEXT_STEPS.md`; do not leave contradictory instructions behind.
- Record only facts verified from code, tests, provider documentation, or observed behavior.
- Include the verification date when reporting volatile external behavior.
- Never place credentials, tokens, raw provider responses, account identifiers, prompts, transcripts, or machine-specific filesystem paths in this directory.
- Repository policy and security documents remain authoritative if this context conflicts with them.

