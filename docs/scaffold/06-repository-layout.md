# Repository Layout

Create exactly this target structure.

```text
eprospera-cli/
├── .changeset/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── CODEOWNERS
│   └── ISSUE_TEMPLATE/
├── bin/
│   └── eprospera.js
├── cli.ocs.yaml
├── docs/
│   ├── AGENT.md
│   ├── README.md
│   ├── decisions/
│   │   └── 0001-commander-over-oclif.md
│   └── recipes/
├── scripts/
│   ├── gen-api-client.ts
│   ├── gen-docs.ts
│   └── gen-completions.ts
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   └── whoami.ts
│   │   ├── config/
│   │   │   ├── get.ts
│   │   │   ├── set.ts
│   │   │   ├── list.ts
│   │   │   └── unset.ts
│   │   ├── entity/
│   │   │   ├── verify.ts
│   │   │   ├── search.ts
│   │   │   ├── get.ts
│   │   │   └── documents.ts
│   │   ├── application/
│   │   │   ├── list.ts
│   │   │   ├── create.ts
│   │   │   ├── get.ts
│   │   │   ├── pay.ts
│   │   │   └── watch.ts
│   │   ├── me/
│   │   │   ├── profile.ts
│   │   │   ├── residency.ts
│   │   │   └── id-verification.ts
│   │   ├── completion.ts
│   │   └── schema.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── generated.ts
│   │   └── errors.ts
│   ├── credentials/
│   │   ├── store.ts
│   │   └── resolve.ts
│   ├── scopes/
│   │   ├── map.ts
│   │   └── check.ts
│   ├── output/
│   │   ├── format.ts
│   │   ├── tty.ts
│   │   └── table.ts
│   ├── prompts/
│   │   └── confirm.ts
│   ├── polling/
│   │   └── watch.ts
│   ├── errors.ts
│   └── version.ts
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .gitignore
├── .npmignore
├── biome.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

## File Responsibilities

| Path | Responsibility |
| --- | --- |
| `bin/eprospera.js` | Shebang file with a single import: `import('../dist/index.js')`. |
| `cli.ocs.yaml` | OpenCLI source of truth. |
| `docs/AGENT.md` | Agent-facing skill file. |
| `docs/README.md` | Human getting-started docs. |
| `docs/decisions/` | ADRs for choices outside the fixed decisions table. |
| `docs/recipes/` | One Markdown recipe per upstream Agent Recipe. |
| `scripts/gen-api-client.ts` | Download `openapi.yaml` and run `openapi-typescript`. |
| `scripts/gen-docs.ts` | Generate README usage and `docs/commands/`. |
| `scripts/gen-completions.ts` | Generate shell completions into `dist/completions/`. |
| `src/index.ts` | Commander root and subcommand wiring. |
| `src/api/client.ts` | Typed `openapi-fetch` client with auth, retry, and rate-limit handling. |
| `src/api/generated.ts` | Generated OpenAPI types. |
| `src/api/errors.ts` | API error to CLI `ExitError` mapping. |
| `src/credentials/store.ts` | `keytar` store with file fallback. |
| `src/credentials/resolve.ts` | Credential precedence chain. |
| `src/scopes/map.ts` | Static command-to-scope map. |
| `src/scopes/check.ts` | Local scope preflight. |
| `src/output/format.ts` | Human, JSON, and raw output dispatch. |
| `src/output/tty.ts` | TTY, `NO_COLOR`, `FORCE_COLOR`, and `CI` handling. |
| `src/output/table.ts` | Human-mode table presets. |
| `src/prompts/confirm.ts` | Inquirer confirm wrappers respecting `--yes` and non-TTY. |
| `src/polling/watch.ts` | Generic polling loop with documented cadence. |
| `src/errors.ts` | `ExitError` class with code and machine envelope. |
| `src/version.ts` | Build-time version injection. |
