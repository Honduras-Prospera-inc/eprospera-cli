---
"@prospera/eprospera-cli": minor
---

Refresh API coverage against the current e-Prospera OpenAPI spec and add three commands.

- Migrate `application pay` to the canonical `/pay/voucher` endpoint with a new `--voucher` flag. `--coupon` remains as a deprecated alias that sends the code as `voucherCode` and prints a deprecation warning on stderr.
- Add `application checkout <id>` to create hosted checkout sessions (standard `sk-` API keys only; Agent Keys are rejected locally). Requires `--redirect-url` and exactly one of `--provider` or `--payment-method <json>`.
- Add `referral list <code>` to list Catalyst referral-code attribution (standard `sk-` API keys only).
- Add `visitor-pass create` to submit public visitor pass applications. This command needs no credential and never sends an Authorization header.
- Regenerate `src/api/generated.ts` from the published spec (18 to 35 paths).
