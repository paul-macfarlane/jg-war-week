# 103: Rich-text Competition description

**What to build:** A Competition's description is rich text in the Announcement editor (headings, lists, links, images), so rules can live there (Competiscore linked rules from game types). The Participant Competition page shows it in full; the Competitions list shows a two-line plain-text preview (`105`).

**Blocked by:** `101`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: descriptions and rules; Participant: preview the description); grilling Q8

## Decisions

- Store as the Announcement body is stored; migrate existing plain-text descriptions (line breaks preserved). Sanitise on render as Announcements do.
- Images by URL and upload follow Announcements (R11).
- Seeds accept rich text or plain text for descriptions.

## Acceptance criteria

- [ ] e2e: an Organizer writes a description with a heading, a list and a link; the Participant page renders them; the list shows a plain two-line preview.
- [ ] Migration test: an existing multi-line description keeps its lines.
- [ ] `pnpm gate` passes.
