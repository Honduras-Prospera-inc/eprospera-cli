# API, Auth, and Scopes

## Generated API Client

Use the upstream OpenAPI spec:

```text
https://docs.eprospera.com/openapi.yaml
```

Generation stack:

- `openapi-typescript` generates `src/api/generated.ts`.
- `openapi-fetch` provides the runtime client.
- Do not hand-write request shapes.

## Base URL Selection

`src/api/client.ts` chooses the base URL from environment:

| Input | Base URL |
| --- | --- |
| `EPROSPERA_BASE_URL` | Use the provided value. |
| `EPROSPERA_ENV=staging` | Use `https://staging-portal.eprospera.com`. |
| Default | Use `https://portal.eprospera.com`. |

## HTTP Behavior

The API client must:

- Inject `Authorization: Bearer <token>` from resolved credentials.
- Implement exponential backoff with full jitter for `5xx` and `429`.
- Cap retries at 3.
- Honor `Retry-After`.
- Map non-2xx responses into typed CLI errors.
- Surface upstream `{ error: { code, message, details } }` shapes verbatim in
  JSON mode where possible.
- Generate a UUIDv4 `Idempotency-Key` header for write requests.

## Credential Resolution

Credentials are resolved in this precedence order:

1. `--api-key <value>` flag.
2. `EPROSPERA_API_KEY` environment variable.
3. Stored credential from the OS keychain via `keytar`.
4. Plaintext fallback file at `$XDG_CONFIG_HOME/eprospera-cli/credentials.json`
   with mode `0600`.

Stored credential schema:

```ts
{
  kind: "ak" | "sk" | "oauth";
  token: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: number;
  owner?: string;
}
```

## Auth Login Flows

`eprospera auth login` supports three flows.

### Agent Key Paste Flow

Flag:

```sh
eprospera auth login --agent-key
```

Behavior:

- User pastes an `ak-...` key from e-Prospera Developer settings.
- CLI validates by calling `GET /api/v1/me/natural-person`.
- If read-only scope only prevents that route, use `verify_rpn` as fallback.
- Store credential with kind `ak`.

### OAuth Device Flow

Flag:

```sh
eprospera auth login --oauth
```

Behavior:

- Use RFC 8628 device authorization.
- Use documented OAuth endpoints at `/oauth/authorize` and `/oauth/token`.
- Store credential with kind `oauth`.
- Wire in v0.1 even though OAuth-only `/me/legal-entities*` commands are deferred.

### Standard Key Paste Flow

Flag:

```sh
eprospera auth login --standard-key
```

Behavior:

- User pastes an `sk-...` key.
- Store credential with kind `sk`.

## Credential Type Awareness

Record credential kind so commands can fail early when the user attempts a route
that is Agent-Key-only or OAuth-only with the wrong credential.

Prefer an actionable local error over letting the API return a generic `401` or
`403`.

## Scope Map

Agent Keys are scope-checked. Every endpoint documented by e-Prospera lists its
required scope.

The CLI ships a static scope map in `src/scopes/map.ts`, generated from:

- `openapi.yaml`
- Agent Keys documentation

Each subcommand maps to its required scope string.

## Local Scope Check

Before a subcommand sends a request:

- Read cached credential scopes.
- Check whether the required scope is present.
- If missing, exit `4`.
- Name the missing scope in the message.
- Point to <https://docs.eprospera.com/agent-keys.html#scope-reference>.

`--skip-scope-check` opts out in case the cache is stale.

Until an introspection endpoint exists, `auth login` can ask the user to confirm
scopes once and cache the set.

## Idempotency

For `application create`, generate and send an `Idempotency-Key` UUIDv4 per call.

Record the key in the local log so agents can retry safely.
