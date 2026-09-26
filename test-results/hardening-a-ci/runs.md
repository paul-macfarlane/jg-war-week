# 06: CI runs smoke and a migration drift check

## 06-AC2: a schema change without a migration fails the drift step

- Throwaway draft PR https://github.com/paul-macfarlane/jg-war-week/pull/77 (branch `chore/drift-check-probe`, base `fix/hardening-a-safety`). It added one nullable column to `faq_item` in `src/db/schema.ts`, with no `drizzle/` migration. Closed unmerged and the branch deleted after this run.
- Run: https://github.com/paul-macfarlane/jg-war-week/actions/runs/36265647553 (job `checks`)
- Steps: install, lint, format, typecheck and `db:migrate` passed. **Migration drift check: failure.** test, build and smoke were skipped.
- Drift step output (tail):

```
[✓] Your SQL migration file ➜ drizzle/0008_flimsy_rhodey.sql 🚀
 M drizzle/meta/_journal.json
?? drizzle/0008_flimsy_rhodey.sql
?? drizzle/meta/0008_snapshot.json
##[error]src/db/schema.ts has changes with no migration. Run pnpm db:generate and commit drizzle/.
##[error]Process completed with exit code 1.
```

## 06-AC1: a PR run shows smoke passing in CI

- PR https://github.com/paul-macfarlane/jg-war-week/pull/78, run https://github.com/paul-macfarlane/jg-war-week/actions/runs/36265877480 on head `f25d65d`: **success**.
- Steps: install, lint, format:check, typecheck, db:migrate, Migration drift check, test, build and **pnpm smoke** all succeeded. The smoke log has no `FAIL -` lines.
- Job duration was about 2 minutes (19:23:18Z → 19:25:16Z), under the ticket's ~10-minute budget.
- The closeout commit that follows changes only `.scratch/` records and this file, and its own CI run is on the PR.
