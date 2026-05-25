# Implementation Status

Last updated: 2026-05-25

This file tracks what has been implemented, what remains, and implementation
notes that should survive across agent sessions.

## Completed

- Step 1: Repository skeleton, package metadata, strict TypeScript, Biome,
  Vitest, Changesets, MIT license, executable shim, and target directory layout.
- Step 2: `cli.ocs.yaml` with all v0.1 commands, global flags, exit codes,
  examples, endpoint metadata, and scope metadata.
- Step 3: Code generation scripts for OpenAPI types, README usage,
  `docs/commands/`, shell completions, and fallback OpenCLI validation.
- Step 4: API client core:
  - typed `openapi-fetch` client
  - base URL selection
  - bearer token injection
  - retry with full jitter for `5xx` and `429`
  - `Retry-After` support
  - non-2xx response mapping to `ExitError`
  - network timeout mapping
  - idempotency keys for legal-entity application writes
  - MSW-backed unit tests for common API statuses and request behavior

## Remaining Build Plan

- Step 5: Credential storage, credential resolution, static scope map, and local
  scope preflight checks.
- Step 6: Output formatting, TTY/color behavior, human tables, JSON/raw modes,
  and `--fields`.
- Step 7: Real command implementations with Zod input validation.
- Step 8: `docs/AGENT.md` agent-facing usage guide.
- Step 9: Opt-in staging e2e tests.
- Step 10: GitHub Actions CI/release workflows, single-file binaries, and
  initial changeset.

## Current Verification Commands

```sh
pnpm run check
pnpm run validate:ocs
pnpm test
pnpm run build
```

## Agent-Friendly CLI Notes

The current scaffold already aligns with the main current recommendations:

- Keep data on stdout and diagnostics/progress on stderr.
- Provide machine modes with `--json`, `--raw`, `--quiet`, and stable exit
  codes.
- Provide a self-describing command surface through `eprospera schema`.
- Avoid prompts in automated contexts via `--yes` and non-TTY behavior.
- Keep long-running watch output newline-delimited in JSON mode.
- Add focused agent docs instead of one oversized all-purpose guide.

References checked:

- Speakeasy, "Making your CLI agent-friendly":
  https://www.speakeasy.com/blog/engineering-agent-friendly-cli
- Speakeasy CLI generation capabilities:
  https://www.speakeasy.com/docs/cli-generation
- OpenTelemetry JavaScript docs:
  https://opentelemetry.io/docs/languages/js/
- Sentry Node.js OpenTelemetry docs:
  https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/

## Diagnostics Candidates

These are candidates only. Telemetry is out of scope for v0.1 and must remain
off by default if added later.

Open-source packages:

- `msw`: adopted for HTTP mocking.
- `execa`: add during Step 7 for binary-level command integration tests.
- `debug` or a tiny internal logger: useful for opt-in `EPROSPERA_DEBUG=1`
  diagnostics written to stderr only.
- `@opentelemetry/api` plus `@opentelemetry/sdk-node`: future opt-in local or CI
  tracing, especially for retry and polling behavior.

Paid or hosted tools to evaluate later:

- Sentry: error and performance diagnostics; supports OpenTelemetry integration.
- Honeycomb or Datadog: OpenTelemetry-backed traces for e2e and staging
  diagnostics if this CLI is used in automated workflows at scale.
- Speakeasy CLI generation: useful as a benchmark or possible paid generator if
  maintaining the command surface by hand becomes too expensive.

Constraints:

- No default telemetry.
- Never record bearer tokens, request bodies with personal data, signed document
  URLs, or credential storage paths in remote diagnostics.
- Diagnostics output must never pollute stdout in JSON/raw modes.
