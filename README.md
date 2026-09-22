# eprospera-cli

[![npm version](https://img.shields.io/npm/v/@prospera/eprospera-cli.svg)](https://www.npmjs.com/package/@prospera/eprospera-cli)
[![npm downloads](https://img.shields.io/npm/dm/@prospera/eprospera-cli.svg)](https://www.npmjs.com/package/@prospera/eprospera-cli)

**Package registry:** [`@prospera/eprospera-cli` on npm](https://www.npmjs.com/package/@prospera/eprospera-cli)

TypeScript command-line interface for the e-Prospera public API.

`eprospera` is designed for scriptable legal-entity, amendment, certificate,
application, personal-document, identity, tax, auth, configuration, completion,
and schema workflows. The CLI is JSON-friendly by
default so it can be used cleanly from shells, CI jobs, and agentic tools.

## Status

The package is published to npm as `@prospera/eprospera-cli`. The OpenCLI
command spec, generated API types, command implementations, completion/doc
generation scripts, validation tooling, CI, release automation, trusted
publishing, and bundled executable build are in place.

## Requirements

- Node.js `^22.13.0 || >=23.5.0`
- pnpm 11.3.0

## Install

```sh
npm install -g @prospera/eprospera-cli
eprospera --help
```

For local development:

```sh
pnpm install
pnpm run gen:all
pnpm run build
```

## Command Surface

The command surface is defined in `cli.ocs.yaml`.

| Area | Commands |
| --- | --- |
| Legal entities | `entity verify`, `entity search`, `entity get`, `entity documents` |
| Amendments | `entity amendment list/create/get/update/pay/submit` |
| Certificates of Good Standing | `entity certificate list/create/get/pay` |
| Applications | `application list`, `application create`, `application get`, `application pay`, `application checkout`, `application watch` |
| Current user | `me profile`, `me residency`, `me id-verification`, `me documents`, `me legal-entities list/get/documents` |
| Taxes | `tax status`, `tax list`, `tax get`, `tax download` |
| Referrals | `referral list` |
| Visitor passes | `visitor-pass create` |
| Auth | `auth login`, `auth whoami`, `auth logout` |
| Config | `config get`, `config set`, `config list`, `config unset` |
| Shells | `completion bash`, `completion zsh`, `completion fish`, `completion powershell` |
| Schema | `schema` |

Common global flags:

```sh
--json
--raw
--fields id,status
--api-key <value>
--dry-run
--yes
```

## Authentication

The CLI is intended to resolve credentials in this order:

1. `--api-key <value>`
2. `EPROSPERA_API_KEY`
3. Credentials saved by `eprospera auth login`

Use `eprospera --json auth whoami` to confirm which credential the CLI resolved.
Add `--verify` to perform an API identity check where the credential type
supports one:

```sh
eprospera --json auth whoami --verify
```

For an interactive user session, use OAuth device authorization. The CLI opens
the e-Próspera consent page, stores tokens in the OS keychain when available,
rotates refresh tokens automatically, and revokes the remote session on logout:

```sh
eprospera auth login --oauth
eprospera --json tax status
eprospera --yes auth logout
```

Do not commit API keys, request payloads, `.env` files, or exported credentials.
The repository ignore rules are configured to keep those out of the public repo.

## OAuth Access Boundaries

OAuth login does not provide access to e-Próspera administration features or
other users' records. It authorizes only the permissions shown on the browser
consent page. Legal-entity commands are limited to entities selected during
consent, and entity tax access also requires the user to remain an active
representative.

The tax commands are read-only. They can inspect obligations and submitted
filings or download an assessment or return, but cannot create, edit, submit, or
pay a filing.

## Amendments and Certificates of Good Standing

These commands support standard API keys and Agent Keys. Agent Keys require
`agent:entity.filing.read` for list/get, `agent:entity.filing.create` for
create/update, and `agent:entity.filing.pay` for pay/submit. The API enforces
active representation; Agent Keys are limited to API-incorporated entities and
writes also require an active Manifestation of Will. OAuth is not supported for
these filing commands.

Each command performs one API step. For example, put the proposed changes in
`amendment.json`:

```json
{"updatedName":"Example Holdings","updatedExtension":"LLC"}
```

```sh
eprospera --json entity amendment list "$ENTITY_ID"
eprospera --json --dry-run entity amendment create "$ENTITY_ID" --file amendment.json
eprospera --json --yes entity amendment create "$ENTITY_ID" --file amendment.json
eprospera --json entity amendment get "$ENTITY_ID" "$FILING_ID"
eprospera --json --yes entity amendment update "$ENTITY_ID" "$FILING_ID" --file changes.json
eprospera --json --yes entity amendment pay "$ENTITY_ID" "$FILING_ID" --voucher "$VOUCHER_CODE"
```

Save `data.id` from creation as the filing ID. Creation can reuse the existing
Draft and **replaces all proposals**, clearing omitted fields. Use `update` for
later edits: omitted fields are preserved, and explicit `null` clears a proposal.
Creation requires at least one non-null change; update requires at least one
field. Every revision invalidates the previous signature.

An active representative must open the returned `data.nextSteps.signatureUrl`
and sign in the portal before payment. The CLI does not open the browser or sign
on the representative's behalf. Full-coverage voucher payment also submits the
amendment for review. If paid through the portal, read the filing and submit when
`data.nextSteps.submitReady` is true:

```sh
eprospera --json --yes entity amendment submit "$ENTITY_ID" "$FILING_ID"
```

`Approved` means registry changes were applied; document generation can still be
pending. Retrieve generated files through `entity documents`; do not assume the
first document belongs to this filing. `Rejected` includes a rejection reason.

For a Certificate of Good Standing:

```sh
eprospera --json entity certificate list "$ENTITY_ID"
eprospera --json --yes entity certificate create "$ENTITY_ID"
eprospera --json --yes entity certificate pay "$ENTITY_ID" "$REQUEST_ID" --voucher "$VOUCHER_CODE"
eprospera --json entity certificate get "$ENTITY_ID" "$REQUEST_ID"
```

The list response includes `eligibility`; `taxCompliant: null` is not confirmation
of compliance. Creation sends `{}` by default and can reuse an open or issued
request; save its `data.id`. Optional `--file contest.json` accepts:

```json
{"contest":{"note":"Please review the payment confirmation.","proofUrl":"https://example.test/replace-with-approved-portal-upload"}}
```

Unknown top-level or contest fields are rejected locally to catch misspelled keys.
The proof URL must be an actual approved portal upload; the placeholder above is
not valid evidence. There is no certificate-proof upload command. Reuse of an
issued request does not establish its current eligibility. Payment starts
asynchronous issuance/review; a paid invoice can temporarily remain in
`Pending Payment`. Read the same request until `Issued`, `Rejected`, or
`Cancelled`. Only `Issued` with a non-null `documentUrl` provides the certificate.
There is no separate certificate submit step.

New filing writes are sent once, without automatic retries. An invalid voucher
can leave an amendment invoiced and locked; a timeout or error can occur after
payment succeeds. Read the existing resource before another write. For
`submission_not_queued`, retain the filing/invoice IDs and retry `amendment submit`
when appropriate; do not create a replacement or pay again. Structured errors
preserve the upstream `code` and original `error.details`, with recovery state
provided separately under `error.recovery`. Reads keep
the existing backoff and `Retry-After` handling. See the
[API filing guide](https://docs.eprospera.com/entity-filings) for lifecycle and recovery details.

## Personal Documents

`me documents` returns document metadata/URLs and the active Agreement of
Coexistence. Use an Agent Key with `agent:person.documents.read`, or OAuth with
`eprospera:person.documents.read`. Standard API keys are not supported.

Default OAuth login scopes are unchanged. Request fresh consent explicitly:

```sh
eprospera auth login --oauth --scopes "openid profile email offline_access eprospera:person.documents.read"
eprospera --json me documents
```

The OAuth client must allow this scope. `--scopes` replaces the default scope
list, and login replaces the stored session: include any other scopes you still
need. Existing tokens do not acquire new permissions automatically.

An empty document list, a null active agreement, or a null signed-document URL
is a valid response. Historical files are not proof of an active agreement; a
template PDF is not a signed document. The CLI prints the returned metadata and
does not download files. If downloading a URL separately, never forward the API
Bearer credential to the document host. See the
[personal documents guide](https://docs.eprospera.com/personal-and-applicant-documents).

New commands preserve full API envelopes in JSON/raw mode. Select nested fields
with, for example, `--fields data.id,data.nextSteps.signatureUrl` on amendment
detail, or `--fields agreementOfCoexistence` on personal documents. Human output
also includes eligibility and active-agreement metadata alongside the data.

## Sensitive Output

Personal documents, filing responses, tax assessments, returns, and legal-entity documents contain
confidential information. Treat terminal output, redirected JSON, and downloaded
files accordingly:

- do not place them in source control, shared logs, or build artifacts;
- remember that CI systems and shell-history tooling may retain command output;
- downloaded tax PDFs use owner-only file permissions on supported platforms;
- existing files are not overwritten unless `--yes` is supplied; and
- run `eprospera --yes auth logout` when finished to revoke the OAuth session.

Credentials use the operating-system keychain when available. The protected
local-file fallback is intended for a single-user workstation, not a shared
machine.

## Development

Useful scripts:

```sh
pnpm run gen:api          # Generate TypeScript types from the public OpenAPI spec
pnpm run gen:docs         # Regenerate tracked command docs under docs/commands/
pnpm run gen:completions  # Generate shell completions under dist/
pnpm run validate:ocs     # Validate cli.ocs.yaml against the OpenCLI schema
pnpm run typecheck        # Run TypeScript without emitting files
pnpm test                 # Run unit tests
pnpm run test:e2e         # Run opt-in staging e2e tests when EPROSPERA_E2E=1
pnpm run check            # Run formatting/lint checks and typecheck
pnpm run bundle           # Build a portable ncc executable at dist/bundle/
pnpm run pack:smoke       # Install the packed tarball in a clean temp project
```

The pre-commit hook runs `pnpm run gen:all` to keep generated artifacts current.

## Packaging

The npm package is configured to include the runtime entrypoint, compiled output,
the OpenCLI spec, license, changelog, and README. It excludes source, tests,
scripts, local docs, CI config, source maps, logs, and environment files.

Before publishing or tagging a release, check the package contents:

```sh
npm pack --dry-run --json --ignore-scripts
pnpm run pack:smoke
```

## Release

Before publishing or tagging a release, run the full local gate:

```sh
pnpm run gen:all
pnpm run check
pnpm run validate:ocs
pnpm test
pnpm run build
pnpm run bundle
npm pack --dry-run --json --ignore-scripts
pnpm run pack:smoke
```

Releases are managed by Changesets and GitHub Actions. npm trusted publishing is
configured for repository `Honduras-Prospera-inc/eprospera-cli` and workflow
file `release.yml`, so future publishes should not require a long-lived
`NPM_TOKEN` secret.

Merging a feature PR with a Changeset starts the release workflow. It applies the
version bump and changelog, synchronizes `cli.ocs.yaml` with `package.json`, and
regenerates command docs. The CLI reads that package version. The pending minor
Changeset for filing and personal-document commands targets `0.4.0` from `0.3.0`.

With a `CHANGESETS_GITHUB_TOKEN` repository secret granting pull request and
contents write permissions, the workflow opens or updates the release PR.
Without it, the workflow still bumps versions on `changeset-release/main`, but a
maintainer must open that branch's PR because the current organization policy
blocks GitHub Actions from creating PRs. Merging the release PR separately
triggers npm publishing, the GitHub release, and release bundle uploads.

```sh
npm install -g @prospera/eprospera-cli
eprospera --help
```

The initial `0.1.0` publish was performed manually from an authenticated npm
maintainer account, then matched with the GitHub release
`@prospera/eprospera-cli@0.1.0`.

## License

MIT
