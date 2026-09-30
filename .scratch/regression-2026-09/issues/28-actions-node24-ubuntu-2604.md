# 28: GitHub Actions on Node 24 and Ubuntu 26.04

**What to build:** Clear the two warnings every workflow run shows, before GitHub's `ubuntu-latest` migration starts on 2026-10-19.

**Blocked by:** none

**Status:** in-progress

**Source:** Seed workflow annotations while deploying tickets 11 and 27, 2026-09-30

## Need

- **Maintainer:** every run of `ci.yml`, `migrate.yml` and `seed.yml` warns that `pnpm/action-setup@v4` targets the deprecated Node 20, and that `ubuntu-latest` moves to Ubuntu 26.04 from 2026-10-19 to 2026-11-19 (actions/runner-images#14748). An unplanned image switch could break CI, migrations or a seed run mid-War Week prep.

## Decisions

- `pnpm/action-setup` v4 → v6 (v5 moved to Node 24; v6 adds pnpm 11 support, nothing removed). `actions/upload-artifact` v4 → v7 (v6 moved to Node 24; v7's direct uploads and ESM don't affect our use). `actions/checkout@v5` and `actions/setup-node@v5` already run on Node 24 and stay.
- Pin `runs-on: ubuntu-26.04` in all three workflows instead of riding `ubuntu-latest`: 26.04 is GA, Playwright 1.63 supports it (`playwright install --with-deps`), and the PR's CI run proves the pipeline there before the label moves. A later image change becomes a deliberate edit.

## Acceptance criteria

- [ ] No workflow uses an action that runs on Node 20.
- [ ] All three workflows run on `ubuntu-26.04`.
- [ ] The PR's `checks` job (Postgres service, build, smoke, Playwright e2e) passes on `ubuntu-26.04`.
- [ ] Migrate passes on the merge to `staging`; the next Seed run passes (manual; human).

## Comments
