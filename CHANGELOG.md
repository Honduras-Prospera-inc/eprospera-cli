# Changelog

All notable changes to `@prospera/eprospera-cli` will be documented in this
file. This file is managed by [Changesets](https://github.com/changesets/changesets);
do not edit it by hand. To propose a change to published behavior, run
`pnpm exec changeset` and commit the generated entry under `.changeset/`.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

No unreleased changes.

## 0.1.1 - 2026-05-25

### Patch Changes

- Pin prompt runtime dependencies and align Node engine metadata to avoid npm
  install engine warnings from transitive prompt packages.

## 0.1.0 - 2026-05-25

- Initial public release of `@prospera/eprospera-cli`.
- Added the v0.1 command surface, generated OpenCLI schema/docs/completions,
  API client core, credential handling, output formatting, tests, CI, npm
  packaging, bundled release assets, and GitHub Actions release workflow.
