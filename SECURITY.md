# Security Policy

`eprospera-cli` handles bearer credentials (API keys, session tokens, OAuth
tokens) for the e-Prospera public API. We take vulnerability reports seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Instead, use one of these private channels:

1. **GitHub Private Vulnerability Reporting** — preferred. Open the
   [Security Advisories](https://github.com/Honduras-Prospera-inc/eprospera-cli/security/advisories/new)
   page on this repository and submit a draft advisory.
2. **Email** — `security@prospera.hn`. Encrypt sensitive details if possible.

Please include:

- A description of the issue and its impact.
- The affected version (`eprospera --version`) and platform.
- Reproduction steps or a proof of concept.
- Any logs, stack traces, or request/response samples — **with credentials,
  bearer tokens, and PII redacted**.

We will acknowledge your report within **3 business days** and aim to provide a
remediation plan or status update within **10 business days**. We will credit
reporters in the published advisory unless you ask to remain anonymous.

## Scope

In scope:

- The CLI in this repository (`@prospera/eprospera-cli`) and its published
  artifacts on npm.
- Credential handling: resolution precedence, storage (`keytar` / `credentials.json`),
  logging, redaction, and exposure through stdout/stderr.
- Scope preflight (`src/scopes/`) and authorization-related exit codes.
- The OpenCLI spec (`cli.ocs.yaml`) and generated artifacts insofar as they
  affect runtime behavior.

Out of scope:

- The upstream e-Prospera API itself — report API vulnerabilities directly to
  Prospera; see the contact email above.
- Third-party dependencies (report upstream; we will pick up patched versions
  as they ship).
- Issues that require an already-compromised local machine or shell.
- Social engineering, physical attacks, or denial of service against
  Prospera's hosted services.

## Supported versions

While the CLI is pre-1.0, only the latest published `0.x` minor receives
security fixes. Once a stable `1.x` is released, this section will be updated
with a longer support window.

## Safe-harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, service disruption, or
  data destruction.
- Give us a reasonable window to remediate before public disclosure.
- Do not exfiltrate data beyond what is necessary to demonstrate the issue.

## Credential hygiene reminders

If you suspect an API key has leaked:

1. Revoke it immediately via the e-Prospera console.
2. Rotate any keys stored locally with `eprospera auth logout` followed by a
   fresh `eprospera auth login`.
3. Check shell history, CI logs, and recorded terminal sessions for residue.
