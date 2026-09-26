# D1 evidence (data layer), commit 23c63b0

Environment: local Postgres (docker compose, port 2345), `DATABASE_DRIVER=pg`.

- `pnpm test`: Test Files 67 passed (67), Tests 916 passed (916).
- `pnpm vitest run src/db/migration-copy.test.ts`: 4 passed. Covers spec 2a: live edition copied (deduplicated, lowercased, non-JG dropped, `organizer_emails` unchanged, rerun changes nothing); earliest upcoming wins with no live; latest complete; no War Week gives no rows. Negative check: flipping the upcoming order to DESC made the upcoming case fail.
- `src/mutations/organizers.test.ts`: the two-connection last-Organizer race passes. Negative check: removing `.for("update")` makes it fail (`expected [ { ok: true }, { ok: true } ] to have a length of 1`).
- `pnpm build`: succeeded. `pnpm smoke`: exit 0, 145 `ok -` lines, no `FAIL`.
- CI drift check (`pnpm db:generate`, then `git status --porcelain drizzle`): "No schema changes", porcelain empty.

Worker output as reported; orchestrator screened the diff (migration SQL, Organizer mutations, loader, create-next Host copy).
