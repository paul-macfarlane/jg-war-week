# D6 evidence (smoke checks and docs), commits d4b7f33, 611f9b8

Local Postgres (port 2345, `DATABASE_DRIVER=pg`).

- `pnpm test`: 77 files, 1344 tests.
- `pnpm smoke`: exit 0, 175 `ok -`, 0 `FAIL`, 30 new checks, covering:
  - a Host allowed and refused;
  - the Participant refused per family;
  - the posted `warWeekId` beating the `admin_edition` cookie;
  - `/admin` trimmed for a Host, and the Admin link;
  - order of checks;
  - a former Host;
  - the error boundary.
- Error boundary (04-AC3): with `faq_item` renamed, `/xi/faq` answers 200, because the page streams and the status is sent before the query fails. The response carries the errored-boundary `<template data-dgst>`, an `E{"digest"…}` row and the edition nav, and no Next default text. The layout's `errorScripts` chunk contains the ErrorScreen copy. The rendered copy is proven separately in a browser (`hardening-b-browser/`).

The integrated gate output is in `hardening-b-gate/`.
