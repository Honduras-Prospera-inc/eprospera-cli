# Repository Guidelines

## Project Structure & Module Organization

This is a single-package TypeScript ESM CLI. Source code lives in `src/`.
Command modules mirror the CLI groups under `src/commands/` (`auth`, `config`,
`entity`, `application`, `me`). Shared runtime code belongs in `src/api/`,
`src/credentials/`, `src/scopes/`, `src/output/`, `src/prompts/`, and
`src/polling/`. The OpenAPI types in `src/api/generated.ts` are generated; update
the generator or source schema instead of hand-editing them. `cli.ocs.yaml` is the
source of truth for command metadata. Scripts live in `scripts/`, tests in `test/`,
and generated outputs such as `dist/` are ignored locally. Tracked command docs
live under `docs/commands/` and are regenerated from `cli.ocs.yaml`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies and prepare Git hooks.
- `pnpm run build`: compile TypeScript with `tsc` into `dist/`.
- `pnpm test`: run Vitest once in Node mode.
- `pnpm run check`: run `biome check .` plus `tsc --noEmit`.
- `pnpm run validate:ocs`: validate `cli.ocs.yaml` against the OpenCLI schema.
- `pnpm run gen:all`: regenerate API types, command docs, and completions; this
  also runs in the configured pre-commit hook.

Use Node `^22.13.0 || >=23.5.0` and the pinned package manager, `pnpm@11.3.0`.

## Coding Style & Naming Conventions

Biome enforces 2-space indentation, 100-character lines, double quotes,
semicolons, and trailing commas. TypeScript is strict with `NodeNext` modules, so
keep imports explicit and remove unused symbols. Use `camelCase` for functions and
variables, `PascalCase` for types, and kebab-case filenames for CLI commands such
as `id-verification.ts`. Keep command implementations aligned with
`cli.ocs.yaml`.

## Testing Guidelines

Vitest includes files matching `test/**/*.test.ts`. Add focused tests near the
relevant category, currently `test/unit/`, and name them `*.test.ts`. Cover command
metadata, schema expectations, and shared helper behavior when changing
`cli.ocs.yaml`, generators, or runtime utilities. Run `pnpm test` and
`pnpm run check` before submitting changes.

## Commit & Pull Request Guidelines

The history is minimal (`Initial commit`, `first commit`), so use short,
imperative commit subjects going forward, for example `Add config command
validation`. Pull requests should describe CLI or API behavior changes, link any
issue, call out generated artifacts from `pnpm run gen:all`, and include terminal
output or screenshots for user-visible CLI changes. Confirm `pnpm test`,
`pnpm run check`, and `pnpm run validate:ocs` in the PR.

## Security & Configuration Tips

Never commit `.env` files, API keys, certificates, or local request payloads such
as `application.json`. Use `EPROSPERA_OPENAPI_URL` only for trusted schema sources.
Avoid logging bearer tokens or persisted credentials.
