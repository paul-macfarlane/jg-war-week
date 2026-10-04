# 103: Rich-text Competition description

**What to build:** A Competition's description is rich text in the Announcement editor (headings, lists, links, images by URL), so rules can live there (Competiscore linked rules from game types). The Participant Competition page shows it in full. The Competitions list's two-line preview is ticket `105` (R19).

**Part of:** Epic R18 (one work package; see the epic for branch, migration, gate and test data).

**Blocked by:** `101` (order inside R18)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: descriptions and rules); grilling Q8; red-team pass 1 B1, W6, W7, M4

## Decisions

- **Storage:** `competition.description` becomes `jsonb` `Content`, as `announcement.body` and a schedule item's description. The migration is the epic's: `USING NULL`, no conversion; deployed data is reset from the seeds (Paul).
- **Sanitised on write and on render** (W6): the save validates with `contentInputSchema` (as `src/lib/announcements.ts`), and every render goes through the existing rich-text renderer. Hosts write descriptions too, so the write check matters.
- **Images by URL only**, as Announcements (W6; there is no upload, `.scratch/war-weeker/spec.md:274`).
- **Size** (M4): the same limits as an Announcement body; the old 2000-character cap goes.
- **Seeds** accept a description as rich-text content or a plain string. The loader turns a string into one paragraph per non-empty line (`src/seed/load.ts`, with a helper beside `src/lib/rich-text/plain-text.ts`); loading twice stays idempotent.
- **Every reader** of `competition.description` renders rich text or reads plain text through `toPlainText` (`src/lib/rich-text/plain-text.ts`): the Participant Competition page, the admin page, the archive, and any MCP output (plain text, no `@`).

## Acceptance criteria

- [x] e2e: an Organizer writes a description with a heading, a list and a link on an `E2E R18 …` Competition; the Participant page renders them.
- [x] Unit test: the seed helper turns "Line one\nLine two\n\nLine three" into three paragraphs, in order.
- [x] Postgres test: a description with a `javascript:` link or a `<script>`-carrying node is refused or stripped on save, as an Announcement body is.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r18`): claimed with Epic R18; `ready-for-agent` → `in-progress`. Execution record: [`R18-execution.md`](../epics/R18-execution.md).

- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r18`): D103 `b052a82` (Sonnet): `drizzle/0030_woozy_amphibian.sql` (`USING NULL`), `contentInputSchema` on save, `RichTextEditor` on the page, `RichText` on the Participant page, `plainTextToContent` for seeds. DR1 added the old-row migration test and an image-by-URL e2e step. Every AC PASS; evidence in [`R18-execution.md`](../epics/R18-execution.md). `ai-review` → `done`. PR: https://github.com/paul-macfarlane/jg-war-week/pull/130
