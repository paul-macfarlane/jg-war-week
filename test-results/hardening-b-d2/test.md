# D2 evidence (access rule, actions, /admin), commits 1395b21, 3467069

Environment: local Postgres (docker compose, port 2345), `DATABASE_DRIVER=pg`.

- `pnpm test`: Test Files 67 passed (67), Tests 1215 passed (1215).
- `pnpm vitest run src/lib/access.test.ts`: 393 passed. Every family in the spec's table × organizer, host (Catan XI), otherHost (MTG XI), namesakeHost (Catan XII), participant and anonymous. Also covers current-and-posted Competition for Points Entry and Schedule Item edits, Schedule Item unlinking, Announcement author vs non-author and a former Host, default edition and editions list, and a Host's Competition id claimed under another War Week.
- `src/lib/war-week-lifecycle.test.ts`: 43/43 on the status-only rules.
- `pnpm build`: succeeded. `pnpm smoke`: 146 `ok -`, 0 `FAIL`, exit 0.

Worker output as reported. The orchestrator screened `src/auth/authorize.ts` (order: authenticate, id shape, load target, actor, `can`) and `can` in `src/lib/access.ts`.
