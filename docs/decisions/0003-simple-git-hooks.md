# 0003. simple-git-hooks For Precommit

Date: 2026-05-25

## Status

Accepted

## Context

The scaffold requires a precommit hook that runs generated artifact updates.
This repository does not need a broader hook runner yet.

## Decision

Use `simple-git-hooks` and wire `pre-commit` to `pnpm run gen:all`.

## Consequences

- Hook configuration stays in `package.json`.
- Developers run `pnpm install` or `pnpm run prepare` to install the local Git
  hook.
- If generation becomes slow or needs staged-file awareness, revisit `lefthook`.
