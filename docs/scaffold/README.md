# eprospera-cli Scaffold Docs

This directory splits the original scaffold spec into focused working documents.
Treat these docs as the planning source while bootstrapping the repository.

## Working Set

1. [Project and Scope](01-project-and-scope.md) - product context, audience, v0.1 goals, and out-of-scope items.
2. [Decisions and Constraints](02-decisions-and-constraints.md) - fixed technical decisions and ADR requirements.
3. [Command Surface and OpenCLI Spec](03-command-surface-and-ocs.md) - command hierarchy, global flags, examples, schema command, and exit codes.
4. [Runtime Behavior](04-runtime-behavior.md) - output modes, errors, polling, dry-run, confirmation, help, completions, and telemetry.
5. [API, Auth, and Scopes](05-api-auth-and-scopes.md) - API client, credential resolution, auth flows, local scope checking, and idempotency.
6. [Repository Layout](06-repository-layout.md) - exact target tree and file responsibilities.
7. [Build Plan](07-build-plan.md) - ordered implementation steps and per-step verification.
8. [Testing and Release](08-testing-and-release.md) - CI, e2e, release workflow, coverage, and v0.1 quality bar.
9. [Agent Skill and Docs](09-agent-skill-and-docs.md) - `docs/AGENT.md`, generated docs, recipes, and agent-facing behavior.
10. [Reference Links](10-reference-links.md) - authoritative sources to fetch when implementation details are uncertain.

## How To Use These Docs

- Start with `01` and `02` before writing code.
- Use `07` as the implementation checklist.
- Keep `03`, `04`, and `05` open while implementing commands.
- Do not change fixed decisions without an ADR in `docs/decisions/`.
- When docs and upstream references disagree, re-read the upstream source listed in `10-reference-links.md` before coding.
