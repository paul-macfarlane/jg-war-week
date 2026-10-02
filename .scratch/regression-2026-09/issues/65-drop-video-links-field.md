# 65: Videos live in the post, not a separate field

**What to build:** Remove the Announcement form's "Video links" list and the `videoUrls` column. A migration appends each existing Announcement's video links to the end of its body as video nodes (in order), then drops the column. Cards render only the body.

**Blocked by:** 64

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A5

## Decisions

- Migration and every seed that uses `videoUrls` change together (team policy); the seed loader accepts old seeds' video links by converting them the same way, or the seeds are rewritten — the plan decides.
- CONTEXT.md **Announcement**: "rich text (videos included)".

## Acceptance criteria

- [ ] Migration test: an Announcement with two video links ends with two video nodes and no column.
- [ ] Seeds load twice (idempotence); smoke passes.
- [ ] No "Add video link" in `src/`; `pnpm gate` passes.
