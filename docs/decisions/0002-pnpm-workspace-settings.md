# 0002. pnpm Workspace Settings

Date: 2026-05-25

## Status

Accepted

## Context

Modern pnpm releases read install build approvals from workspace settings rather
than the `pnpm` field in `package.json`. The project depends on packages with
legitimate install scripts, including `esbuild` through the toolchain and
`keytar` for credential storage.

## Decision

Add `pnpm-workspace.yaml` at the repository root and allow builds for `esbuild`
and `keytar` there.

## Consequences

- Fresh installs can run required native/package setup without relying on a
  developer's user-level pnpm config.
- The repository has one extra pnpm settings file beyond the initial target
  layout.
