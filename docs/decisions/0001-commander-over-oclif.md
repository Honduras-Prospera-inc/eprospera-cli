# 0001. Commander Over oclif

Date: 2026-05-25

## Status

Accepted

## Context

The v0.1 CLI is a single-package TypeScript command-line wrapper around the
e-Prospera API. The planned command surface is broad but still modest, and the
repository uses `cli.ocs.yaml` as the source of truth for command metadata.

## Decision

Use `commander` for command parsing and command wiring.

## Consequences

- The CLI keeps a small runtime and avoids oclif's generator and plugin
  conventions.
- Help text, generated docs, and completions must be generated from or validated
  against `cli.ocs.yaml` rather than hand-authored in Commander definitions.
- Revisit oclif only if the command tree grows past roughly 30 subcommands or
  needs a plugin model.
