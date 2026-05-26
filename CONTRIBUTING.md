# Contributing to `eprospera-cli`

Thanks for taking the time to contribute. This project is a TypeScript CLI over
the e-Prospera public API; see [`README.md`](./README.md) for an overview and
[`docs/scaffold/`](./docs/scaffold/) for the authoritative design notes.

## Prerequisites

- Node.js 20 or newer
- pnpm 11.3.0 (pinned via `packageManager` in `package.json`)

## Local setup

```sh
pnpm install
pnpm run gen:all
pnpm run build
pnpm test
```

A `simple-git-hooks` pre-commit hook runs `pnpm run gen:all` so generated
artifacts stay in sync.

## Where to make changes

- **Command surface** (subcommands, flags, exit codes, help-text examples) lives
  in [`cli.ocs.yaml`](./cli.ocs.yaml). It is the source of truth. The Commander
  wiring in `src/index.ts`, the per-command docs under `docs/commands/`, and the
  shell completions under `dist/completions/` are generated from or validated
  against it. **Update the YAML first, then run `pnpm run gen:all`.**
- **Generated API types** (`src/api/generated.ts`) come from the upstream
  OpenAPI spec via `pnpm run gen:api`. Never hand-edit that file.
- **Architectural decisions** are recorded in
  [`docs/decisions/`](./docs/decisions/). Anything outside the fixed-decisions
  table in [`docs/scaffold/02-decisions-and-constraints.md`](./docs/scaffold/02-decisions-and-constraints.md)
  needs a new ADR.

## Coding standards

- TypeScript strict mode, ESM only (`"type": "module"`, NodeNext).
- Biome handles lint and format: 2-space indent, 100-col width, double quotes,
  semicolons, trailing commas.
- Validate CLI inputs with `zod` at the command boundary.
- Stdout in machine output modes (`--json`, `--raw`) must remain parseable
  JSON, even on error. Logs, spinners, prompts, and human-mode errors go to
  stderr.
- No telemetry. The CLI handles bearer tokens; do not log them or phone home.

Before pushing:

```sh
pnpm check    # biome check + tsc --noEmit
pnpm test
```

## Tests

- Unit tests live under `test/unit/` and run with Vitest (`pnpm test`).
- E2E tests against staging are opt-in. Set `EPROSPERA_E2E=1` and
  `EPROSPERA_API_KEY=<fixture-ak>`; see
  [`docs/scaffold/08-testing-and-release.md`](./docs/scaffold/08-testing-and-release.md).
- Never commit real API keys, request payloads, `.env` files, or exported
  credentials.

## Commits and pull requests

- Keep commits focused. Conventional Commits-style prefixes (`feat:`, `fix:`,
  `docs:`, `chore:`) are welcome but not enforced.
- If your change affects published behavior, add a changeset:

  ```sh
  pnpm exec changeset
  ```

  Changesets manages `CHANGELOG.md` and release versions; do not edit the
  changelog by hand. Maintainers should use `pnpm run version:changesets` for
  release-version PRs so `cli.ocs.yaml` stays aligned with `package.json`.
- Open the PR against `main`. Fill out the PR template. CI must pass.

## Reporting issues

- Bugs and feature requests: use the issue forms under
  [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/).
- Security vulnerabilities: **do not** open a public issue. Follow
  [`SECURITY.md`](./SECURITY.md).
