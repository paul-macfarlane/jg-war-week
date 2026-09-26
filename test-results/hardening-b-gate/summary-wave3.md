# Integrated gate after wave 3 (HEAD 2e82621)

Local Postgres (docker compose, port 2345, `DATABASE_DRIVER=pg`), after `pnpm db:migrate` applied 0010. `pnpm gate` exits 0:
- typecheck clean
- lint 0 errors, 7 existing `<img>` warnings
- vitest: 77 files, 1344 tests
- build compiled
- smoke: 145 `ok -`, 0 `FAIL`, including `GET /xi/competitions/<bad id> returns 404` (both cases, D3's layout)

Full output of the final run on the reviewed head: `gate.txt`.

Earlier runs, recorded for honesty:
1. Lint failed because ESLint scanned the wave-3 worktrees' `.next` output. The worktrees were removed after integration.
2. One test failed because the local database lacked 0010 (`pnpm gate` runs tests before smoke migrates). CI migrates first.
