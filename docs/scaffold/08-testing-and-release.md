# Testing and Release

## Test Stack

Use:

- `vitest` for unit and integration tests.
- `msw` for HTTP mocking.
- `execa` for binary-level integration tests.
- Opt-in e2e tests against staging.

## Test Layout

```text
test/
├── unit/
├── integration/
└── e2e/
```

## Unit Tests

Cover:

- API error mapping.
- Retry behavior for `5xx` and `429`.
- `Retry-After` handling.
- Credential resolution precedence.
- Credential file fallback and mode `0600`.
- Scope map and local scope checks.
- Output mode resolution.
- `--fields` field masks.
- Polling cadence and timeout handling.

## Integration Tests

Use `msw` to mock the e-Prospera API.

For each command:

- Execute the built CLI or TS entrypoint end-to-end.
- Assert exit code.
- Assert stdout is valid JSON in `--json` and `--raw`.
- Assert human-mode noise does not appear on stdout when machine mode is active.
- Assert errors use the standard envelope.

## E2E Tests

E2E tests are skipped by default.

Run only when:

```sh
EPROSPERA_E2E=1
EPROSPERA_API_KEY=<fixture-agent-key>
```

Target:

```text
https://staging-portal.eprospera.com
```

Scope:

- Read-only Recipe 1.
- Read-only Recipe 4.
- Avoid real entity creation and paid flows.

Command:

```sh
EPROSPERA_E2E=1 pnpm test:e2e
```

## CI Workflow

`.github/workflows/ci.yml` runs on PR.

Required jobs:

- Install with pnpm.
- Run `pnpm gen:all`.
- Verify generated files have no diff.
- Run `pnpm exec biome check`.
- Run `pnpm exec tsc --noEmit`.
- Run `pnpm test`.
- Matrix on Node 20 and Node 22.
- Run on Linux, macOS, and Windows before v0.1.0 release.

## Release Workflow

`.github/workflows/release.yml` runs on push to `main`.

Required behavior:

- Publish through Changesets.
- Publish npm package as `@prospera/eprospera-cli`.
- Create a GitHub Release.
- Build single-file binaries with `@vercel/ncc`.
- Attach Linux, macOS, and Windows binaries to the release.

## v0.1 Quality Bar

The PR that publishes v0.1.0 must show:

- All four documented Agent Recipes runnable as shell one-liners.
- `eprospera schema` output validates against the OpenCLI schema.
- `docs/AGENT.md` reviewed by at least one human.
- `docs/AGENT.md` reviewed by one fresh Claude Code session that has not seen
  the build conversation.
- Test coverage above 80% on `src/`.
- CI green on Node 20 and 22.
- CI green on Linux, macOS, and Windows.
- README Quick Start works on a fresh machine in under 90 seconds.

## Changeset

Add a changeset for the initial v0.1.0 release.
