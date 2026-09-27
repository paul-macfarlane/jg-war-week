# CI on PR #81

Run https://github.com/paul-macfarlane/jg-war-week/actions/runs/36284339305 on `23a8b48` (the closeout commit; code identical to `72a8620`): **success**.

| Step | Result |
|---|---|
| pnpm lint | success |
| pnpm typecheck | success |
| Migration drift check | success |
| pnpm test | success |
| pnpm build | success |
| pnpm smoke | success (178 `ok -` lines in the log, 0 FAIL; locally the `db:migrate` ok shares a line with the migration spinner, so a line-anchored count reads 177) |
| pnpm e2e | success, 22 passed |
