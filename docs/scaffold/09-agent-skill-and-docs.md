# Agent Skill and Docs

## Agent Skill File

Create:

```text
docs/AGENT.md
```

This is a single-file skill for LLM-based callers. It should be modeled on:

- Anthropic skill format.
- Speakeasy agent recommendations.
- e-Prospera Skills for AI Agents page.

Keep it under 300 lines.

## Required Structure

`docs/AGENT.md` must contain:

1. TL;DR
   - What the CLI is.
   - The three commands an agent typically needs:
     - `auth login`
     - `application create`
     - `application watch`
2. Capability matrix
   - One row per command.
   - Columns:
     - command
     - credential type
     - required scope
     - exit codes you may see
     - common dead-end
3. Decision tree
   - "I have X, I want Y, run Z".
4. Agent-mode invocation
   - Always pass `--json --yes`.
   - Parse stdout as JSON.
   - Branch on exit code.
5. Recipes
   - Four entries paralleling upstream Agent Recipes.
   - Shell pipelines preferred.

## Agent Invocation Rules

Agents should generally use:

```sh
eprospera --json --yes <noun> <verb>
```

When output size matters, agents should add:

```sh
--fields id,status,name
```

When token efficiency matters, agents should use:

```sh
--raw
```

## Agent Recovery Strategy

Document how agents should branch on exit codes:

| Exit code | Agent behavior |
| --- | --- |
| 2 | Fix command syntax or inspect `eprospera schema`. |
| 3 | Ask for a credential or run `auth login`. |
| 4 | Ask the user for a credential with the missing scope. |
| 5 | Stop retrying the resource lookup. |
| 6 | Surface the conflict and ask for a different state or input. |
| 7 | Respect `Retry-After` and retry later. |
| 8 | Fix local input using `details`. |
| 9 | Surface last known polling state and ask whether to continue. |
| 10 | Treat the application or payment as terminally failed. |

## Human Docs

Create:

```text
docs/README.md
```

This is the human getting-started guide.

Minimum contents:

- Installation.
- Login flows.
- Quick Start.
- JSON mode for automation.
- Link to generated command docs.
- Link to `docs/AGENT.md`.

## Generated Command Docs

`scripts/gen-docs.ts` emits:

```text
docs/commands/
```

One Markdown file per command.

Each generated command doc should include:

- Synopsis.
- Description.
- Arguments.
- Flags.
- Environment fallbacks.
- Exit codes.
- Runnable examples.

The README usage section is generated between:

```md
<!-- BEGIN GEN -->
<!-- END GEN -->
```

Do not hand-edit generated sections.

## Recipes

Create one Markdown recipe per upstream Agent Recipe in:

```text
docs/recipes/
```

Each recipe should include:

- Goal.
- Required credential type.
- Required scopes.
- Command pipeline.
- Expected JSON shape.
- Common failures and exit codes.
