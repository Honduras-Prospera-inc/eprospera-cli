---
name: eprospera-cli
description: Use when working with the e-Prospera CLI, Agent Keys, legal entities, applications, current-user data, npx usage, JSON automation, or agent workflows for e-Prospera API tasks.
---

# eProspera CLI

Use the e-Prospera CLI for API-backed entity, application, identity, referral,
visitor pass, auth, configuration, completion, and schema workflows.

## Command selection

When working inside this source repo before the first npm publish, prefer the
local build:

```sh
pnpm run build
node bin/eprospera.js schema
node bin/eprospera.js --json <group> <command>
```

After the npm package is published, prefer `npx` when the CLI is not installed:

```sh
npx -y @prospera/eprospera-cli@latest schema
npx -y @prospera/eprospera-cli@latest --json <group> <command>
```

If `eprospera` is already installed in the environment, use it directly.

## Agent defaults

- Start with `schema` when the command shape is unclear.
- Use `--json` for machine-readable output.
- Use `--raw` when compact JSON is more useful than pretty JSON.
- Use `--fields id,statusId,name` to reduce large read responses.
- Use `--yes` for write commands in non-interactive agent workflows.
- Use `--dry-run` before creating or paying applications when constructing input.
- Parse stdout as data; treat stderr as diagnostics.
- Branch on exit codes. If `docs/AGENT.md` is present, use it for the full
  command matrix, recipes, and recovery behavior.

## Authentication

Credentials may come from `--api-key`, `EPROSPERA_API_KEY`, or saved credentials
from `auth login`.

Never print bearer tokens, commit credentials, write `.env` files, or store local
request payloads such as `application.json` unless the user explicitly asks and
the file is meant to stay local.

Use Agent Keys for delegated automation. If a command fails with exit code `4`,
request a credential with the missing scope instead of retrying.

## Common workflows

Inspect available commands:

```sh
eprospera schema
```

Save an Agent Key:

```sh
eprospera auth login --agent-key --scopes agent:person.details.read,agent:entity.application.create,agent:entity.application.pay,agent:entity.application.read
```

Create, pay, and watch an application:

```sh
eprospera --json --yes application create --file application.json
eprospera --json --yes application pay <application-id> --voucher <code>
eprospera --json application watch <application-id> --timeout 30m
```

Create a hosted checkout session (standard `sk-` API keys only; hand `data.url`
to a human):

```sh
eprospera --json --yes application checkout <application-id> \
  --redirect-url https://example.com/return --provider stripe
```

Read current user profile:

```sh
eprospera --json --fields id,fullName,email me profile
```

List referral-code attribution (standard `sk-` API keys only):

```sh
eprospera --json referral list <code>
```

Submit a visitor pass application (no credential required; consent flag is
mandatory):

```sh
eprospera --json --yes visitor-pass create --first-name <name> --last-name <name> \
  --date-of-birth YYYY-MM-DD --email <address> --signature "<full legal name>" \
  --consent-to-background-check --referral-source "<text>"
```
