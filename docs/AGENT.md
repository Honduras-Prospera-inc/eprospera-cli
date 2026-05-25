# eprospera Agent Guide

## TL;DR

`eprospera` is a JSON-first CLI for the e-Prospera public API. Use it to verify
entities, inspect applications, read current-user data, and create or monitor
legal-entity applications.

Most agent workflows use these commands:

```sh
eprospera auth login --agent-key --scopes agent:person.details.read
eprospera --json --yes application create --file application.json
eprospera --json application watch <application-id> --timeout 30m
```

For automation, prefer:

```sh
eprospera --json --yes <group> <command>
```

Parse stdout as JSON. Treat stderr as diagnostics only.

## Capability Matrix

| Command | Credential | Required scope | Exit codes | Common dead-end |
| --- | --- | --- | --- | --- |
| `entity verify <rpn>` | `ak`, `sk` | `agent:verify_rpn` | `0,2,3,4,5,7,8,9` | RPN must be 14 digits starting with 8 or 9. |
| `entity search <query>` | `ak`, `sk` | `agent:registry.search` | `0,2,3,4,7,8,9` | Empty or too-broad search terms. |
| `entity get <id>` | `ak`, `sk` | `agent:entity.read` | `0,2,3,4,5,7,9` | ID must be a UUID. |
| `entity documents <id>` | `ak`, `sk` | `agent:entity.documents.read` | `0,2,3,4,5,7,9` | Missing document-read scope. |
| `application list` | `ak`, `sk` | `agent:entity.application.read` | `0,3,4,7,9` | Credential cannot see the target application. |
| `application create --file <path>` | `ak`, `sk` | `agent:entity.application.create` | `0,2,3,4,7,8,9` | JSON body fails local schema validation. |
| `application get <id>` | `ak`, `sk` | `agent:entity.application.read` | `0,2,3,4,5,7,9` | ID must be a UUID. |
| `application pay <id> --coupon <code>` | `ak`, `sk` | `agent:entity.application.pay` | `0,2,3,4,5,6,7,8,9,10` | Coupon does not fully cover payment. |
| `application watch <id>` | `ak`, `sk` | `agent:entity.application.read` | `0,2,3,4,5,7,9,10` | Application reaches rejection or payment failure. |
| `me profile` | `ak`, `oauth` | `agent:person.details.read` | `0,3,4,7,9` | Standard API keys are not valid for `me` commands. |
| `me residency` | `ak`, `oauth` | `agent:person.residency.read` | `0,3,4,7,9` | Missing residency-read scope. |
| `me id-verification` | `ak`, `oauth` | `agent:person.id_verification.read` | `0,3,4,7,9` | Missing ID-verification scope. |
| `auth login` | `ak`, `sk` | none | `0,2,3` | Choose exactly one of `--agent-key` or `--standard-key`. |
| `auth whoami` | `ak`, `sk`, `oauth` | none | `0,3` | No credential is configured. |
| `auth logout` | `ak`, `sk`, `oauth` | none | `0` | None. |
| `config get <key>` | none | none | `0,2,5` | Only `api.baseUrl` is supported. |
| `config set <key> <value>` | none | none | `0,2,8` | URL values must be valid absolute URLs. |
| `config list` | none | none | `0` | None. |
| `config unset <key>` | none | none | `0,2` | Only `api.baseUrl` is supported. |
| `completion bash` | none | none | `0` | Install into the shell profile outside the CLI. |
| `completion zsh` | none | none | `0` | Install into the shell profile outside the CLI. |
| `completion fish` | none | none | `0` | Install into the shell profile outside the CLI. |
| `completion powershell` | none | none | `0` | Install into the shell profile outside the CLI. |
| `schema` | none | none | `0` | None. |

## Decision Tree

| I have | I want | Run |
| --- | --- | --- |
| An Agent Key | Save it for later commands | `eprospera auth login --agent-key --scopes <csv>` |
| A standard API key | Save it for registry/application commands | `eprospera auth login --standard-key` |
| A one-off token | Avoid local credential storage | `eprospera --api-key "$EPROSPERA_API_KEY" --json <command>` |
| An RPN | Check whether an entity exists | `eprospera --json entity verify <rpn>` |
| A legal entity UUID | Fetch entity details | `eprospera --json entity get <id>` |
| A request JSON file | Create an application | `eprospera --json --yes application create --file application.json` |
| An application UUID | Poll until approved or failed | `eprospera --json application watch <id> --timeout 30m` |
| An unclear command | Inspect command metadata | `eprospera schema` |

## Invocation Rules

- Pass `--json --yes` for write commands in agent mode.
- Use `--raw` when token efficiency matters.
- Use `--fields id,statusId,name` to reduce large read responses.
- Put credentials in `--api-key`, `EPROSPERA_API_KEY`, or `auth login`; never echo tokens.
- Add `--skip-scope-check` for one-off Agent Keys when cached scopes are unavailable.
- Use `EPROSPERA_ENV=staging` for staging e2e checks.
- Use `EPROSPERA_BASE_URL=<url>` only for trusted API endpoints.

Machine-mode errors use this shape:

```json
{
  "error": {
    "code": "INVALID_USAGE",
    "message": "Human-readable failure.",
    "details": {}
  }
}
```

## Exit Code Recovery

| Exit code | Agent behavior |
| --- | --- |
| `0` | Continue. |
| `1` | Surface the unexpected failure and stop. |
| `2` | Fix command syntax or inspect `eprospera schema`. |
| `3` | Ask for a credential or run `auth login`. |
| `4` | Ask for a credential with the missing scope. |
| `5` | Stop retrying the resource lookup. |
| `6` | Surface the conflict and ask for different input or state. |
| `7` | Respect `Retry-After` and retry later. |
| `8` | Fix local input using `error.details`. |
| `9` | Surface the last known polling state and ask whether to continue. |
| `10` | Treat the application or payment as terminally failed. |

## Recipes

### 1. Read Current User Profile

Credential: Agent Key with `agent:person.details.read`, or OAuth credential.

```sh
eprospera --json --fields id,fullName,email me profile
```

Expected stdout is a JSON object for the credential owner. If exit code `4`
appears, request a credential with `agent:person.details.read`.

### 2. Verify and Fetch an Entity

Credential: Agent Key or standard API key with `agent:verify_rpn` and
`agent:entity.read`.

```sh
entity_id="$(
  eprospera --raw entity verify 80000000000012 |
  node -e 'let x="";process.stdin.on("data",d=>x+=d).on("end",()=>console.log(JSON.parse(x).id ?? ""))'
)"
test -n "$entity_id" && eprospera --json entity get "$entity_id"
```

If the verify response has no entity ID, stop and report the verification result.

### 3. Create an Application

Credential: Agent Key or standard API key with
`agent:entity.application.create`.

```sh
eprospera --json --yes application create --file application.json
```

Use `--dry-run` first when constructing `application.json`:

```sh
eprospera --json --dry-run application create --file application.json
```

Fix exit code `8` by editing the request body according to `error.details`.

### 4. Pay and Watch an Application

Credential: Agent Key or standard API key with
`agent:entity.application.pay` and `agent:entity.application.read`.

```sh
eprospera --json --yes application pay "$APPLICATION_ID" --coupon "$COUPON_CODE"
eprospera --json application watch "$APPLICATION_ID" --timeout 30m
```

`application watch` emits newline-delimited JSON whenever the status changes.
Treat exit code `10` as terminal failure and do not retry without new user input.
