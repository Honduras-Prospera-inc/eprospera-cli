# Command Surface and OpenCLI Spec

## OpenCLI Spec Requirement

The repository ships `cli.ocs.yaml` at the root. It describes commands,
arguments, flags, exit codes, and examples in a machine-readable way.

`cli.ocs.yaml` must document at minimum:

- Top-level `info` block with name, version, description, and license.
- Every command listed below.
- Every global flag listed below.
- Exit codes and meanings.
- At least one runnable example per command, drawn from the Agent Recipes docs.

The Commander implementation, generated docs, README usage section, and shell
completion scripts are generated from or validated against this file in CI.

## Command Hierarchy

Use noun-verb commands modeled on `gh`, `docker`, `stripe`, and `vercel`.

```text
eprospera <noun> <verb> [args] [flags]
```

Nouns map to API resources. Verbs map to operations.

## Commands

```text
eprospera entity verify <rpn>
eprospera entity search <query>
eprospera entity get <id>
eprospera entity documents <id>

eprospera application list
eprospera application create [--file <path>]
eprospera application get <id>
eprospera application pay <id> --coupon <code>
eprospera application watch <id>

eprospera me profile
eprospera me residency
eprospera me id-verification

eprospera auth login
eprospera auth whoami
eprospera auth logout

eprospera config get
eprospera config set
eprospera config list
eprospera config unset

eprospera completion bash
eprospera completion zsh
eprospera completion fish
eprospera completion powershell

eprospera schema
```

## Global Flags

Every command should honor these global flags where applicable:

| Flag | Purpose |
| --- | --- |
| `--json` | Pretty-printed JSON to stdout, no color, no spinner, no progress noise. |
| `--raw` | Compact single-line JSON to stdout. |
| `--fields <a,b,c>` | Restrict output keys for read commands. |
| `--quiet` | Suppress incidental human output. |
| `--yes`, `-y` | Skip confirmation prompts. |
| `--api-key <value>` | Highest-precedence credential source, usually for CI. |
| `--dry-run` | Validate locally and print the would-be request without making network calls. |
| `--help` | Show help sourced from `cli.ocs.yaml`. |
| `--version` | Show CLI version. |
| `--no-auto-json` | Disable auto-switch to JSON when stdout is not a TTY. |
| `--skip-scope-check` | Bypass local scope preflight if cached scopes are stale. |

## Exit Codes

Agents branch on stable exit codes. Document these in `cli.ocs.yaml`.

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Generic failure or unexpected error |
| 2 | Invalid usage, bad flag, or missing argument |
| 3 | Authentication failure, including `401` or no credential configured |
| 4 | Authorization failure, including missing scope or MoW revoked |
| 5 | Not found, usually `404` |
| 6 | Conflict, including `409`, name collision, or impossible state transition |
| 7 | Rate limit, usually `429`; include `Retry-After` in the error payload |
| 8 | Validation error, usually `400`; include `details` array |
| 9 | Timeout, including polling or network timeout |
| 10 | Application or coupon entered terminal failure state such as `Rejected` or `PaymentFailed` |

## Schema Command

`eprospera schema` prints the complete `cli.ocs.yaml` document to stdout.

This is a dedicated affordance for LLM-based callers. An agent should be able to
run this once, ingest the command tree, and know all flags and exit codes.

## Verification

Validate `cli.ocs.yaml` against the OpenCLI JSON schema.

Preferred:

```sh
ocli check cli.ocs.yaml
```

Fallback:

- Add a simple JSON Schema validator script.
- Keep the validation command wired into CI.
