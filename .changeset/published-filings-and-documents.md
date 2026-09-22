---
"@prospera/eprospera-cli": minor
---

Add entity amendment list/create/get/update/pay/submit commands, Certificate of
Good Standing list/create/get/pay commands, and personal document metadata reads
with `me documents`. Refresh types from the published API and regenerate command
documentation and completions.

Filing writes support local dry runs and confirmations and are sent once without
automatic retries. Preserve upstream error codes and filing/invoice recovery
context in `error.recovery` without changing `error.details`, and display signing
steps, eligibility, and active-agreement metadata. Reject unknown certificate
request fields locally instead of silently discarding them.
Personal documents require an explicit Agent Key or OAuth document-read scope;
default OAuth consent remains unchanged.
