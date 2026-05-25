# Build Plan

Implement in this order. Run the verification command after each step before
moving on.

## Step 1: Repository Skeleton

Tasks:

- Run `pnpm init`.
- Set `"type": "module"`.
- Set `"engines": { "node": ">=20" }`.
- Set `"bin": { "eprospera": "./bin/eprospera.js" }`.
- Install dev dependencies:
  - `typescript`
  - `@types/node`
  - `tsx`
  - `vitest`
  - `@biomejs/biome`
  - `@changesets/cli`
  - `@vercel/ncc`
- Install runtime dependencies:
  - `commander`
  - `zod`
  - `openapi-fetch`
  - `@inquirer/prompts`
  - `picocolors`
  - `cli-table3`
  - `ora`
  - `keytar`
- Generate `tsconfig.json` with strict mode, NodeNext module, ES2022 target,
  declarations, and source maps.
- Configure `biome.json` with sensible defaults.
- Run `pnpm exec biome init`.
- Add `vitest.config.ts` with the `node` environment.
- Initialize changesets with `pnpm exec changeset init`.
- Create the directory tree from the repository layout doc.
- Keep all files empty stubs except:
  - `LICENSE`
  - `.gitignore`
  - `README.md`

Verify:

```sh
pnpm exec tsc --noEmit
```

## Step 2: OpenCLI Spec Authoring

Tasks:

- Write `cli.ocs.yaml`.
- Use the OpenCLI Specification draft at <https://opencli.org> as the schema
  reference.
- Include all commands from the command surface doc.
- Include all global flags.
- Include all exit codes.
- Include one runnable example per command, drawn from Agent Recipes.

Verify:

```sh
ocli check cli.ocs.yaml
```

Fallback verification:

- Add a simple JSON Schema validator in `scripts/`.

## Step 3: Code Generation

Tasks:

- Write `scripts/gen-api-client.ts`.
  - Download `https://docs.eprospera.com/openapi.yaml`.
  - Run `openapi-typescript`.
  - Emit `src/api/generated.ts`.
  - Exit non-zero on schema drift.
- Write `scripts/gen-docs.ts`.
  - Consume `cli.ocs.yaml`.
  - Emit README usage between `<!-- BEGIN GEN -->` and `<!-- END GEN -->`.
  - Emit one Markdown file per command in `docs/commands/`.
- Write `scripts/gen-completions.ts`.
  - Emit bash, zsh, fish, and PowerShell completions into `dist/completions/`.
- Wire scripts in `package.json`:
  - `gen:api`
  - `gen:docs`
  - `gen:completions`
  - `gen:all`
- Add `gen:all` as a precommit hook using lefthook or simple-git-hooks.
- Document the hook choice in an ADR.

Verify:

```sh
pnpm run gen:all
pnpm exec tsc --noEmit
```

## Step 4: API Client Core

Tasks:

- Implement `src/api/client.ts`.
- Create a typed `openapi-fetch` client.
- Select base URL from `EPROSPERA_BASE_URL`, `EPROSPERA_ENV`, or default.
- Inject bearer token from credential resolution.
- Add exponential backoff with full jitter on `5xx` and `429`.
- Cap retries at 3.
- Honor `Retry-After`.
- Map non-2xx responses in `src/api/errors.ts`.
- Generate UUIDv4 `Idempotency-Key` for write requests.

Verify:

- Unit-test the client against `msw` fixtures for each documented status code in
  the Agent Recipes common error table.

## Step 5: Credentials and Scope Check

Tasks:

- Implement `src/credentials/store.ts`.
  - Use `keytar` first.
  - Fall back to `$XDG_CONFIG_HOME/eprospera-cli/credentials.json`.
  - Enforce mode `0600`.
- Implement `src/credentials/resolve.ts`.
- Implement `src/scopes/map.ts`.
  - Hand-author initially from Agent Keys scope tables.
  - Cross-check in CI by parsing live docs.
- Implement `src/scopes/check.ts`.
  - Return `{ ok: true } | { ok: false, missing: string }`.

Verify:

- Unit test every route in the scope map.
- Add a CI job that checks the map against live HTML.

## Step 6: Output Formatting

Tasks:

- Implement `src/output/tty.ts`.
- Implement `src/output/format.ts`.
  - Single `print(data, { schema })` function.
  - Resolve output mode to `human`, `json`, or `raw`.
  - Route JSON to stdout.
  - Route incidental output to stderr.
- Implement `src/output/table.ts`.
  - Add table presets for entities, applications, and documents.
- Implement `--fields` with a tiny local utility.
  - Do not pull in `lodash.get`.

Verify:

- Snapshot tests for each output mode of each command success and error path.

## Step 7: Commands

For each subcommand:

- Define a Zod schema for inputs.
- Call the scope check.
- Call the typed API client.
- Map success and error responses through `src/output/format.ts`.
- Set the right exit code.

Recommended order:

1. Recipe 4: `me/*`
2. Recipe 1: `entity verify`, `entity search`, `entity get`
3. Recipe 2: `application create`, `application pay`, `application watch`
4. Plumbing: `auth`, `config`, `completion`, `schema`

Verify per command:

- Add an `msw`-mocked integration test.
- Run the binary end-to-end with `execa`.
- Assert exit code and stdout JSON shape.

## Step 8: Agent Skill File

Tasks:

- Write `docs/AGENT.md`.
- Keep it under 300 lines.
- Model the shape on the upstream Skills for AI Agents page.
- Treat it as product documentation, not filler docs.

Verify:

- A cold agent should be able to use the CLI from `docs/AGENT.md` alone.

## Step 9: E2E Against Staging

Tasks:

- Add `test/e2e/`.
- Skip by default.
- Run only when:
  - `EPROSPERA_E2E=1`
  - `EPROSPERA_API_KEY` contains a fixture Agent Key
- Hit `staging-portal.eprospera.com`.
- Cover read-only Recipe 1 and Recipe 4.

Verify:

```sh
EPROSPERA_E2E=1 pnpm test:e2e
```

## Step 10: Release Pipeline

Tasks:

- Add `.github/workflows/ci.yml`.
  - `pnpm install`
  - `pnpm gen:all`
  - verify no generated diff
  - `pnpm exec biome check`
  - `pnpm exec tsc --noEmit`
  - `pnpm test`
  - matrix on Node 20 and 22
- Add `.github/workflows/release.yml`.
  - Trigger on push to `main`.
  - Run `changesets publish`.
  - Create a GitHub Release.
  - Attach Linux, macOS, and Windows single-file binaries built with `@vercel/ncc`.
- Add a changeset for v0.1.0.

Verify:

- Run with `act`, or dry-run in a personal fork.
