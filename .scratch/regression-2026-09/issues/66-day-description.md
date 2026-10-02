# 66: A Day can have a short description

**What to build:** An optional **description** on a Day (plain text, up to 280 characters), edited with the Day Theme, shown under the Day's heading on the Schedule (and on Home's Now/Next day header if there is one). Seeds and `Create next War Week` unaffected (Days aren't copied).

**Blocked by:** none (lands in the Days/Schedule form from ticket 58 if R9 has merged)

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A16

## Acceptance criteria

- [ ] Migration adds a nullable column; seed schema accepts an optional `description`; seeds load twice.
- [ ] e2e or smoke: a Day saved with a description shows it on `/[edition]/schedule`; screenshot at both viewports.
- [ ] `pnpm gate` passes.
