# 65: Videos live in the post, not a separate field

**What to build:** Remove the Announcement form's "Video links" list and the `videoUrls` column. A migration appends each existing Announcement's video links to the end of its body as video nodes (in order), then drops the column. Cards render only the body.

**Blocked by:** 64

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A5

## Decisions

- Migration and every seed that uses `videoUrls` change together (team policy); the seed loader accepts old seeds' video links by converting them the same way, or the seeds are rewritten — the plan decides.
- CONTEXT.md **Announcement**: "rich text (videos included)".

## Acceptance criteria

- [x] Migration test: an Announcement with two video links ends with two video nodes and no column.
- [x] Seeds load twice (idempotence); smoke passes.
- [x] No "Add video link" in `src/`; `pnpm gate` passes.

## Comments

## [AI CODE REVIEW]

See `../epics/R11-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r11-content`. AC1 PASS (`src/db/migrations.test.ts`; real seeded data in `test-results/r11-content/migration-real-data.txt`); AC2 PASS (smoke, seeds twice); AC3 PASS (no "Add video link" in `src/`; gate). Migrations `0021_announcement-videos-into-body`, `0022_drop-announcement-video-urls` (destructive; merge and promote outside War Week, decision H1-a). Commits `95b07c8`, `de713eb`. Full record: `../epics/R11-execution.md` [CLOSEOUT].
