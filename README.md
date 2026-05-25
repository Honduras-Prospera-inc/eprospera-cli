# eprospera-cli

TypeScript command-line interface for the e-Prospera public API.

`eprospera` is designed for scriptable legal-entity, application, identity, auth,
configuration, completion, and schema workflows. The CLI is JSON-friendly by
default so it can be used cleanly from shells, CI jobs, and agentic tools.

## Status

This repository is in v0.1 release preparation. The OpenCLI command spec,
generated API types, command implementations, completion/doc generation scripts,
validation tooling, CI, release automation, and bundled executable build are in
place. The npm package is not published until the first Changesets release runs.

## Requirements

- Node.js 20 or newer
- pnpm 11.x

## Install

Once published:

```sh
npm install -g @prospera/eprospera-cli
```

For local development:

```sh
pnpm install
pnpm run gen:all
pnpm run build
```

## Command Surface

The v0.1 command surface is defined in `cli.ocs.yaml`.

| Area | Commands |
| --- | --- |
| Legal entities | `entity verify`, `entity search`, `entity get`, `entity documents` |
| Applications | `application list`, `application create`, `application get`, `application pay`, `application watch` |
| Current user | `me profile`, `me residency`, `me id-verification` |
| Auth | `auth login`, `auth whoami`, `auth logout` |
| Config | `config get`, `config set`, `config list`, `config unset` |
| Shells | `completion bash`, `completion zsh`, `completion fish`, `completion powershell` |
| Schema | `schema` |

Common global flags:

```sh
--json
--raw
--fields id,status
--api-key <value>
--dry-run
--yes
```

## Authentication

The CLI is intended to resolve credentials in this order:

1. `--api-key <value>`
2. `EPROSPERA_API_KEY`
3. Credentials saved by `eprospera auth login`

Do not commit API keys, request payloads, `.env` files, or exported credentials.
The repository ignore rules are configured to keep those out of the public repo.

## Development

Useful scripts:

```sh
pnpm run gen:api          # Generate TypeScript types from the public OpenAPI spec
pnpm run gen:docs         # Regenerate tracked command docs under docs/commands/
pnpm run gen:completions  # Generate shell completions under dist/
pnpm run validate:ocs     # Validate cli.ocs.yaml against the OpenCLI schema
pnpm run typecheck        # Run TypeScript without emitting files
pnpm test                 # Run unit tests
pnpm run test:e2e         # Run opt-in staging e2e tests when EPROSPERA_E2E=1
pnpm run check            # Run formatting/lint checks and typecheck
pnpm run bundle           # Build a portable ncc executable at dist/bundle/
pnpm run pack:smoke       # Install the packed tarball in a clean temp project
```

The pre-commit hook runs `pnpm run gen:all` to keep generated artifacts current.

## Packaging

The npm package is configured to include the runtime entrypoint, compiled output,
the OpenCLI spec, license, changelog, and README. It excludes source, tests,
scripts, local docs, CI config, source maps, logs, and environment files.

Before publishing or tagging a release, check the package contents:

```sh
npm pack --dry-run --json --ignore-scripts
pnpm run pack:smoke
```

## Release

The first public release should happen only after the full local gate passes:

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

For automated releases, configure the repository `NPM_TOKEN` secret and let the
Changesets release workflow publish. For a manual first publish, use:

```sh
npm publish --access public
npm install -g @prospera/eprospera-cli
eprospera --help
```

## License

MIT
