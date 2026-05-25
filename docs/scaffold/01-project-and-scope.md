# Project and Scope

## Product Context

`eprospera-cli` is a thin, well-typed command-line wrapper over the e-Prospera
REST API documented at <https://docs.eprospera.com>.

The API supports two credential types relevant to the CLI:

- Agent Keys, prefixed `ak-...`, issued by an e-resident to delegated automation.
- Standard API keys, prefixed `sk-...`, resident-owned first-party keys supported
  on a subset of routes.

The CLI must expose every Agent-Key-reachable endpoint, print structured JSON for
machine callers, and remain pleasant for interactive human use.

## Audience

The CLI serves two primary audiences:

- Human operators running commands interactively.
- AI agents and other machine callers piping stdout into downstream tools.

Both audiences matter. Human DX and agent DX should be designed together rather
than treated as separate modes bolted onto the tool later.

## v0.1 Outcome

The v0.1 repository should be production-ready and open source from day one:

- TypeScript CLI package published as `@prospera/eprospera-cli`.
- OpenCLI Specification in `cli.ocs.yaml` as the source of truth for commands,
  help text, docs, and completions.
- Typed API access generated from the upstream OpenAPI spec.
- Agent-key-first authentication with OAuth wired for future `/me` expansion.
- Structured output modes suitable for LLM-based callers.
- MIT license and agent-readable docs.

## In Scope For v0.1

- Agent Key and standard API key credential flows.
- OAuth device-flow login plumbing.
- Noun-verb commands listed in the command surface doc.
- Scope-aware local preflight checks.
- Human, JSON, and raw JSON output modes.
- Generated docs, generated shell completions, and `eprospera schema`.
- Application polling through `application watch`.
- CI, release automation, tests, and single-file binaries.

## Out Of Scope For v0.1

- MCP server wrapper. Track for v0.2 as `eprospera mcp serve`.
- Hosted-checkout payment flows using `/checkout_session`; upstream has
  temporarily disabled this for Agent Keys.
- `/api/v1/me/legal-entities*` OAuth-only subcommands. Wire auth in v0.1, but
  defer these commands until v0.3.
- Telemetry.
- Plugin system.
- Alternate output formats such as YAML or CSV.
