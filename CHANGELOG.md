# Changelog

## 0.3.0

### Minor Changes

- 874d394: Add OAuth device login with automatic refresh and remote logout revocation, consented
  legal-entity commands, and read-only personal and entity tax commands with secure PDF downloads.

## 0.2.0

### Minor Changes

- fb3737a: Refresh API coverage against the current e-Prospera OpenAPI spec and add three commands.

  - Migrate `application pay` to the canonical `/pay/voucher` endpoint with a new `--voucher` flag. `--coupon` remains as a deprecated alias that sends the code as `voucherCode` and prints a deprecation warning on stderr.
  - Add `application checkout <id>` to create hosted checkout sessions (standard `sk-` API keys only; Agent Keys are rejected locally). Requires `--redirect-url` and exactly one of `--provider` or `--payment-method <json>`.
  - Add `referral list <code>` to list Catalyst referral-code attribution (standard `sk-` API keys only).
  - Add `visitor-pass create` to submit public visitor pass applications. This command needs no credential and never sends an Authorization header.
  - Regenerate `src/api/generated.ts` from the published spec (18 to 35 paths).

## 0.1.2

### Patch Changes

- 0693b3c: Align package manager metadata and OpenCLI schema version with the published package.
- f052ca8: Clarify `auth whoami` scope-cache output and add `auth whoami --verify` for explicit API identity checks where supported.
- 00c0f56: Let one-off Agent Keys from `--api-key` and `EPROSPERA_API_KEY` defer scope authorization to the API when no cached scope metadata is available. Release versioning now also keeps the OpenCLI schema version in sync with the package version.

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
