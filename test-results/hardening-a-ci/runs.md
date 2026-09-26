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

Recorded in the epic's closeout and the PR description once the work package PR's CI run completes (the run URL can't exist before the PR does).
