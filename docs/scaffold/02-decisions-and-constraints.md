# Decisions and Constraints

These decisions are fixed inputs. Do not re-litigate them during scaffolding.

| Area | Decision | Rationale |
| --- | --- | --- |
| Language | TypeScript, strict mode | API consumers want types generated from `openapi.yaml`. |
| Runtime | Node.js >= 20 LTS | Native fetch, top-level await, and `node:` imports. |
| Module format | ESM only with `"type": "module"` | Modern package format without dual-publish complexity. |
| Package manager | `pnpm` | Matches Prospera monorepo conventions. |
| CLI framework | `commander` >= 12 | Minimal API, strong TypeScript support, lower ceremony than oclif for a single-package CLI. Revisit oclif only if subcommands exceed roughly 30. |
| Argument spec | OpenCLI Specification YAML in `cli.ocs.yaml` | Spec-first command surface matching `openapi.yaml` for the API. |
| HTTP client | `openapi-typescript` plus `openapi-fetch` | Generate request and response shapes from upstream OpenAPI. Do not hand-write request shapes. |
| Validation | `zod` at the CLI boundary | Mirrors upstream API validation behavior and error paths. |
| Prompts | `@inquirer/prompts` | Maintained successor to `inquirer`. |
| Terminal UX | `picocolors`, `cli-table3`, `ora` | Color, tables, and spinners. Suppress all three when `--json`, `--quiet`, or stdout is not a TTY. |
| Testing | `vitest` plus `msw` | Modern test runner with HTTP mocking against `staging-portal.eprospera.com`. |
| Linting and formatting | `biome` | Single fast tool replacing ESLint and Prettier. |
| Releasing | `changesets`, GitHub Actions, `@vercel/ncc` | Publish to npm and attach single-file binaries. |
| License | MIT | Standard for open-source SDK-adjacent tooling. |

## ADR Policy

Anything outside the fixed table is a real technical choice and must be recorded
as a short ADR in `docs/decisions/`.

Seed ADR:

- `docs/decisions/0001-commander-over-oclif.md`

Additional expected ADRs:

- Precommit hook tool choice, such as lefthook or simple-git-hooks.
- Any deviation from the target repository layout.
- Any change in generated artifact strategy.

## Non-Negotiable Standards

- `cli.ocs.yaml` is the source of truth for the command surface.
- Commander code, generated docs, README usage, and shell completions must be
  generated from or validated against `cli.ocs.yaml`.
- Hand-edited drift in generated surfaces is a CI failure.
- JSON output must remain parseable in machine modes.
- Credentials are bearer tokens; avoid telemetry and avoid leaking them to logs.
