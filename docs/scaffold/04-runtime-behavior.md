# Runtime Behavior

## Output Modes

Every command supports three output modes:

| Mode | Trigger | Behavior |
| --- | --- | --- |
| Human | Default when stdout is a TTY | Colored output, tables, and spinners are allowed. |
| JSON | `--json`, or stdout is not a TTY unless `--no-auto-json` is set | Pretty-printed JSON to stdout only. |
| Raw | `--raw` | Compact single-line JSON to stdout only. |

Hard rules:

- JSON goes to stdout.
- Everything else goes to stderr.
- Logs, warnings, spinners, and progress output must never pollute stdout in JSON
  or raw mode.
- Stdout must be parseable JSON in JSON mode, even on error.
- `--fields a,b,c` restricts JSON output keys on read commands.

## Error Envelope

In JSON mode, surface errors with an envelope compatible with the upstream API
where possible:

```json
{
  "error": {
    "code": "FORBIDDEN_SCOPE",
    "message": "Agent Key lacks agent:entity.read",
    "httpStatus": 403,
    "details": null
  }
}
```

Map upstream status codes to CLI exit codes using the command surface doc.

## Terminal UX

Use:

- `picocolors` for color.
- `cli-table3` for tables.
- `ora` for spinners.

Suppress all terminal decorations when:

- `--json` is set.
- `--raw` is set.
- `--quiet` is set.
- stdout is not a TTY.

`src/output/tty.ts` owns terminal detection and `NO_COLOR`, `FORCE_COLOR`, and
`CI` behavior.

## Polling and Watch Commands

The e-Prospera API has no webhooks. Long-running operations are represented with
polling.

Primary watch command:

```sh
eprospera application watch <id> \
  [--timeout 30m] \
  [--initial-interval 30s] \
  [--max-interval 5m]
```

Required behavior:

- Poll every 30 seconds for the first 10 minutes.
- Back off to every 5 minutes after that.
- Default hard timeout is 30 minutes.
- Exit `0` on `Approved`.
- Exit `10` on terminal failure states such as `Rejected` or `PaymentFailed`.
- Exit `9` on timeout and surface the last response.
- In JSON mode, emit newline-delimited JSON, one object per state transition.

## Dry Run and Confirmation

All write commands accept `--dry-run`.

`--dry-run` must:

- Run local Zod validation.
- Print the request that would be sent.
- Avoid making the network call.

Destructive or irreversible writes prompt for confirmation in interactive mode:

- `application create`
- `application pay`

Prompts are suppressed by:

- `--yes` or `-y`
- non-TTY execution

## Help and Completions

`--help` on every command must include at least one runnable example sourced from
`cli.ocs.yaml`.

Completion commands:

```sh
eprospera completion bash
eprospera completion zsh
eprospera completion fish
eprospera completion powershell
```

Completions are generated from `cli.ocs.yaml`.

## Telemetry

No telemetry in v1.

If telemetry is ever added, it must be off by default and behind explicit opt-in.
This CLI handles bearer tokens, so users should never wonder what the tool phones
home.
