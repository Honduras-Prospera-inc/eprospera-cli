# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Current Status

`eprospera-cli` is published to npm as `@prospera/eprospera-cli@0.1.1`.
The v0.1 command surface is implemented:

- `entity verify/search/get/documents`
- `application list/create/get/pay/watch`
- `me profile/residency/id-verification`
- `auth login/whoami/logout`
- `config get/set/list/unset`
- `completion` and `schema`

The human/agent usage guide is `docs/AGENT.md`. Keep it aligned with runtime
behavior whenever command flags, scopes, output, or exit-code behavior change.
`docs/STATUS.md` tracks implementation state and remaining release-readiness
items.

## Common Commands

Package manager is **pnpm** (`pnpm@10.33.4`). Supported Node versions are
`^20.17.0 || ^22.13.0 || >=23.5.0`.

- `pnpm install` - install dependencies.
- `pnpm run gen:all` - regenerate API types, command docs, and completions.
- `pnpm run check` - Biome check plus TypeScript typecheck.
- `pnpm test` - Vitest unit/integration test suite.
- `pnpm run validate:ocs` - validate `cli.ocs.yaml`.
- `pnpm run build` - TypeScript build to `dist/`.
- `pnpm run bundle` - build the portable `dist/bundle/eprospera.mjs`.
- `npm pack --dry-run --json --ignore-scripts` - inspect npm package contents.
- `pnpm run pack:smoke` - install and smoke-test the packed tarball.

Run the full local gate before release-impacting changes:

```sh
pnpm run gen:all
pnpm run check
pnpm run validate:ocs
pnpm test
pnpm run build
pnpm run bundle
npm pack --dry-run --json --ignore-scripts
pnpm run pack:smoke
```

E2E tests against staging are opt-in: set `EPROSPERA_E2E=1` and
`EPROSPERA_API_KEY=<fixture-ak>` before `pnpm run test:e2e`.

The local binary entry is `bin/eprospera.js`, which imports `dist/src/index.js`;
build first before running the checkout as a CLI.

## Source Of Truth

`cli.ocs.yaml` defines the command surface, global flags, exit codes, examples,
endpoint metadata, and scope metadata. `eprospera schema` prints this document
for agents.

Generated files must not be hand-edited:

- `src/api/generated.ts` comes from the upstream OpenAPI spec via
  `pnpm run gen:api`.
- `docs/commands/` comes from `cli.ocs.yaml` via `pnpm run gen:docs`.
- `dist/completions/` comes from `cli.ocs.yaml` via
  `pnpm run gen:completions`.

When the command surface changes, update `cli.ocs.yaml`, then run
`pnpm run gen:all`.

## Architecture

- `src/index.ts` wires Commander commands and global options.
- `src/commands/` contains command handlers with Zod input validation.
- `src/api/` contains the typed API client, generated OpenAPI types, retry
  behavior, auth header injection, timeout mapping, and API-to-CLI error
  mapping.
- `src/credentials/` resolves credentials in this order: `--api-key`,
  `EPROSPERA_API_KEY`, keychain, plaintext fallback config file.
- `src/scopes/` maps commands to supported credential types and scopes, then
  performs local preflight checks before API calls.
- `src/output/` owns human, JSON, and raw output. Machine-mode success and error
  output must stay parseable on stdout.
- `src/polling/watch.ts` handles `application watch`; JSON/raw modes emit NDJSON
  on state transitions.
- `src/prompts/confirm.ts` suppresses write confirmations when `--yes` is set
  or stdin is non-interactive.
- `src/errors.ts` defines `ExitError` and the machine error envelope
  `{ error: { code, message, httpStatus, details } }`.

## Runtime Contracts

- Data goes to stdout. Diagnostics, prompts, and human-mode errors go to stderr.
- `--json` prints pretty JSON; `--raw` prints compact JSON.
- Non-TTY stdout defaults to JSON unless `--no-auto-json` is used.
- `--fields a,b,c` filters read outputs by top-level or dotted paths.
- `--yes` is required for noninteractive write flows that would otherwise
  confirm.
- `auth login` prompts unless a token is passed through global `--api-key`.
- `entity verify` returns verification result and active state, not a
  legal-entity ID. Use `entity search` before `entity get` when starting from an
  RPN.

Stable exit codes:

`0` success · `1` generic · `2` usage · `3` authentication ·
`4` authorization · `5` not found · `6` conflict · `7` rate limit ·
`8` validation · `9` timeout · `10` terminal failure.

## Engineering Rules

- Keep TypeScript strict and ESM-only (`"type": "module"`, NodeNext).
- Use Zod at command boundaries; do not rely only on API validation.
- Prefer existing runtime helpers over new abstractions.
- Do not log, print, commit, or store bearer tokens outside the existing
  credential store behavior.
- Do not add default telemetry. Future diagnostics must be opt-in and must never
  pollute stdout in JSON/raw modes.
- Add focused tests for command behavior, scope checks, output formatting, and
  API error mapping when those surfaces change.

## Releases

Changesets manages package versions. Add a changeset with
`pnpm exec changeset` when changing published behavior, package metadata, CLI
flags, output contracts, or dependencies shipped to users.

GitHub Actions publishes from `main` using npm trusted publishing. There should
be no long-lived `NPM_TOKEN` secret for normal releases. Release tags created by
Changesets use `v<version>`, and the release workflow attaches Linux, macOS, and
Windows bundle assets to that release.

Do not manually publish to npm unless the maintainer explicitly asks for that
operation.
