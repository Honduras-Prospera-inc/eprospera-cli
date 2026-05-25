<!--
Thanks for the contribution! A few quick reminders:
- The command surface lives in `cli.ocs.yaml`. Update it first, then run
  `pnpm run gen:all` to regenerate docs and completions.
- `src/api/generated.ts` is generated from the upstream OpenAPI spec — do not
  hand-edit it.
- See CONTRIBUTING.md for coding standards and the testing matrix.
-->

## Summary

<!-- One or two sentences on what this PR changes and why. -->

## Related issues

<!-- e.g. Closes #123, Refs #456 -->

## Type of change

- [ ] Bug fix (no published-behavior change)
- [ ] Bug fix (changes published behavior)
- [ ] New feature / new command or flag
- [ ] Refactor / internal change
- [ ] Docs only
- [ ] Build, CI, or tooling

## Checklist

- [ ] `pnpm check` passes (Biome + `tsc --noEmit`).
- [ ] `pnpm test` passes.
- [ ] If the command surface changed: `cli.ocs.yaml` was updated **first** and
      `pnpm run gen:all` was run; `docs/commands/` and `dist/completions/` are
      in sync.
- [ ] If published behavior changed: a changeset was added
      (`pnpm exec changeset`).
- [ ] No real API keys, bearer tokens, or PII in code, tests, fixtures, or
      commit messages.
- [ ] Stdout in `--json` / `--raw` modes still produces parseable JSON (errors
      go to stderr).
- [ ] Relevant unit tests added or updated under `test/`.

## Test plan

<!-- How was this verified? Commands run, scenarios checked, screenshots if any. -->

## Notes for reviewers

<!-- Anything reviewers should pay extra attention to: trade-offs, follow-ups,
known limitations. -->
