# Implementation Status

Last updated: 2026-05-26

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
- Step 5: Credential storage, credential resolution, static scope map, and local
  scope preflight checks:
  - keytar-first credential storage with plaintext fallback
  - `0600` credential file and `0700` credential directory enforcement
  - `--api-key` / `EPROSPERA_API_KEY` / stored credential resolution
  - expired stored credential handling
  - static command scope map aligned with `cli.ocs.yaml`
  - Agent Key and OAuth local scope checks
  - credential type compatibility checks
  - unit tests for store, resolver, scope behavior, and scope-map drift
- Step 6: Output formatting, TTY/color behavior, human tables, JSON/raw modes,
  and `--fields`:
  - output mode resolution for human, JSON, raw, and auto-JSON behavior
  - terminal capability detection for color, spinners, and interactivity
  - JSON/raw success and error printing with stdout/stderr discipline
  - `ExitError` machine envelopes and human error output
  - field selection for top-level and dotted paths
  - human table presets for entities, applications, and documents
  - unit tests for mode resolution, formatting, errors, field selection, and
    table presets
- Step 7: Real command implementations with Zod input validation:
  - Commander entrypoint and executable shim
  - `entity verify/search/get/documents`
  - `application list/create/get/pay/watch`
  - `me profile/residency/id-verification`
  - `auth login/whoami/logout`
  - `config get/set/list/unset`
  - `completion` and `schema`
  - command-level unit tests with injected runtime dependencies
- Step 8: `docs/AGENT.md` agent-facing usage guide under 300 lines.
- Step 9: Opt-in staging e2e test scaffold for read-only commands.
- Step 10: GitHub Actions CI/release workflows, CODEOWNERS, portable `ncc`
  bundle build, and initial Changesets entry.
- Step 11: `@prospera/eprospera-cli@0.1.1` published to npm, npm trusted
  publishing exercised through GitHub Actions, and matching GitHub releases/tags
  created with bundled release assets.
- Step 12: Agent Key auth polish for the next patch release:
  - one-off Agent Keys from `--api-key` and `EPROSPERA_API_KEY` defer scope
    authorization to the API when no local scope cache is available
  - `auth whoami` reports whether scopes are cached locally
  - `auth whoami --verify` performs explicit API identity checks where supported
  - Changesets versioning syncs `cli.ocs.yaml` and regenerates command docs

## Remaining Build Plan

- Human-review `docs/AGENT.md` before the next broad rollout.
- Update public docs and examples after each published release.
- Verify the release asset attach workflow on the next Changesets publish after
  the `v<version>` release tag fix.

## Current Caveats

- `@prospera/eprospera-cli@0.1.1` is published and installable from npm.
- npm package access status is public under the `prospera` org.
- npm trusted publishing is configured for GitHub Actions repository
  `Honduras-Prospera-inc/eprospera-cli`, workflow file `release.yml`, and
  publish permission.
- GitHub releases exist for the manual `@prospera/eprospera-cli@0.1.0` tag and
  the Changesets `v0.1.1` tag; both include bundled release assets for Linux,
  macOS, and Windows.
- The npm install engine warning from transitive `mute-stream@4` was removed in
  `0.1.1` by depending on the exact prompt packages used by the CLI.
- The bundled release artifacts are portable Node.js executables produced by
  `@vercel/ncc`; they require Node.js `^22.13.0 || >=23.5.0`.
- The next Changesets release should exercise both the release asset attach
  workflow and the OpenCLI version sync wrapper.

## Current Verification Commands

```sh
pnpm run check
pnpm run validate:ocs
pnpm test
pnpm run build
pnpm run bundle
npm pack --dry-run --json --ignore-scripts
pnpm run pack:smoke
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
