<!--
  Staging copy of the GitHub org profile README.
  Final location: github.com/Honduras-Prospera-inc/.github → profile/README.md
  GitHub auto-renders that path at https://github.com/Honduras-Prospera-inc
-->

# Honduras Próspera — Developer Tooling

Open source tooling for building on the [e-Prospera](https://eprospera.hn) platform: residency, applications, payments, and the wider ZEDE workflow.

This org is the home of the developer experience around the [e-Prospera public API](https://docs.eprospera.com). If you're integrating, automating, or scripting against e-Prospera, start here.

---

## Start here

### [`eprospera-cli`](https://github.com/Honduras-Prospera-inc/eprospera-cli)

TypeScript CLI over the e-Prospera public API. Designed for humans, scripts, and CI — every command has a stable JSON mode, stable exit codes, and runs a local scope preflight before touching the network.

```bash
npm install -g @prospera/eprospera-cli
eprospera --help
```

```bash
# Machine-readable output is the default in pipelines
eprospera application list --json | jq '.[] | .id'

# Scope preflight fails fast (exit 4) before hitting the API
eprospera application create --file ./application.json
```

Highlights:

- **OpenCLI-spec driven** — the command surface is defined in `cli.ocs.yaml` and consumed by the CLI, the generated docs, and shell completions.
- **Stable exit codes** — `0` ok · `3` auth · `4` scope · `5` not found · `6` conflict · `7` rate-limited · `8` validation · `9` timeout · `10` terminal failure. Branch on them in scripts.
- **No telemetry.** The CLI handles bearer tokens and does not phone home.
- **Idempotent writes** with a `Idempotency-Key` per request and exponential backoff on `5xx`/`429`.

---

## API

- **Docs:** https://docs.eprospera.com
- **OpenAPI spec:** https://docs.eprospera.com/openapi.yaml
- **Base URLs:** production by default; pass `EPROSPERA_ENV=staging` or `EPROSPERA_BASE_URL=…` to point elsewhere.

---

## Contributing

Each repo carries its own `CONTRIBUTING.md`. Conventions across the org:

- **pnpm** for Node projects (pinned via `packageManager`).
- **Biome** for lint/format; **TypeScript strict mode**, ESM only.
- **Changesets** for releases — open PRs include a changeset for any user-visible change.
- **Generated files are not hand-edited** — update the source of truth (e.g. `cli.ocs.yaml`, OpenAPI spec) and regenerate.

---

## Security

Found a vulnerability? Please **do not** open a public issue. See each repo's `SECURITY.md` for the disclosure address.

---

## License

Unless otherwise noted, repositories in this org are released under the **MIT License**.
