# 103: Rich-text Competition description

**What to build:** A Competition's description is rich text in the Announcement editor (headings, lists, links, images by URL), so rules can live there (Competiscore linked rules from game types). The Participant Competition page shows it in full. The Competitions list's two-line preview is ticket `105` (R19).

**Part of:** Epic R18 (one work package; see the epic for branch, migration, gate and test data).

**Blocked by:** `101` (order inside R18)

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: descriptions and rules); grilling Q8; red-team pass 1 B1, W6, W7, M4

## Decisions

- **Storage:** `competition.description` becomes `jsonb` `Content`, as `announcement.body` and a schedule item's description. The migration is the epic's: `USING NULL`, no conversion; deployed data is reset from the seeds (Paul).
- **Sanitised on write and on render** (W6): the save validates with `contentInputSchema` (as `src/lib/announcements.ts`), and every render goes through the existing rich-text renderer. Hosts write descriptions too, so the write check matters.
- **Images by URL only**, as Announcements (W6; there is no upload, `.scratch/war-weeker/spec.md:274`).
- **Size** (M4): the same limits as an Announcement body; the old 2000-character cap goes.
- **Seeds** accept a description as rich-text content or a plain string. The loader turns a string into one paragraph per non-empty line (`src/seed/load.ts`, with a helper beside `src/lib/rich-text/plain-text.ts`); loading twice stays idempotent.
- **Every reader** of `competition.description` renders rich text or reads plain text through `toPlainText` (`src/lib/rich-text/plain-text.ts`): the Participant Competition page, the admin page, the archive, and any MCP output (plain text, no `@`).

## Acceptance criteria

- [ ] e2e: an Organizer writes a description with a heading, a list and a link on an `E2E R18 …` Competition; the Participant page renders them.
- [ ] Unit test: the seed helper turns "Line one\nLine two\n\nLine three" into three paragraphs, in order.
- [ ] Postgres test: a description with a `javascript:` link or a `<script>`-carrying node is refused or stripped on save, as an Announcement body is.
