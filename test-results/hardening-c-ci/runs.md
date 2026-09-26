# CI on PR #80 (E-AC2, 13-AC1b)

- PR: https://github.com/paul-macfarlane/jg-war-week/pull/80
- Run: https://github.com/paul-macfarlane/jg-war-week/actions/runs/36278986168 (workflow CI, job `checks`, 3m45s), head `b3eb38c`, conclusion `success`.
- Steps, all `success`: lint, format:check, typecheck, db:migrate, migration drift check, test, build, **`pnpm smoke`**, **`pnpm exec playwright install --with-deps chromium`**, **`pnpm e2e`** (`17 passed (44.6s)`). `actions/upload-artifact@v4` was `skipped` (it runs only on failure).
- 0 `FAIL - ` lines in the run log.
- Read with `gh run view 36278986168 --json jobs` and `gh run view 36278986168 --log`.
