# Execution record: Epic R11, Content

Contract: [`R11-content.md`](./R11-content.md) and its tickets
[`64`](../issues/64-editor-matches-journeys.md), [`65`](../issues/65-drop-video-links-field.md),
[`66`](../issues/66-day-description.md), [`67`](../issues/67-roster-import.md),
[`68`](../issues/68-unstart-a-war-week.md).
Planned by `/atlas-plan` on 2026-10-02 against `staging` at `2c8fcc3` (R10 merged, PR #115).
Red-team is **required**: the plan changes the Drizzle schema (drop `announcement.video_urls`, add `day.description`) and access control (two new Organizer-only actions, `participant.import` and `lifecycle.unstart`). Branch: `feat/regression-r11-content`.

## [EXECUTION PLAN]

2026-10-02. Revised after red-team round 1 (PASS, 5 should-fix folded in). Paul answered H0, H1 and H2 on 2026-10-02 (see Human gates and questions).

### Run record

- Work package `regression-r11`; branch `feat/regression-r11-content` from `staging` at `2c8fcc3`.
- Deliverables: **D64** editor, **D67** roster import, **D68** Unstart (wave 1, parallel in worktrees under `.claude/worktrees/regression-r11/war-weeker/d<id>`); **D66** Day description then **D65** video links into the body (wave 2, sequential on the feature branch: both generate Drizzle migrations, and the journal and snapshots must be generated one after the other); **DX** docs (wave 3, feature branch).
- Edges: D64 → D65 (D65 relies on the editor's video node being the only way to add a video). D66, D67, D68 have no edges. All → DX.
- Predicted shared files in wave 1: `src/lib/access.ts` and its test (D67 adds `participant.import`, D68 adds `lifecycle.unstart`, adjacent lines in `ORGANIZER_ONLY` and the action union), and `scripts/smoke/hosts.ts` (both add an organizer-only row). The orchestrator merges both entries at integration. `CONTEXT.md`, `docs/*`, `/about` and the organizer guide are DX-only except where a deliverable below says otherwise.
- Workers run format, typecheck, lint and unit. The orchestrator runs build, smoke and e2e on the integrated branch after each wave (one Postgres via `docker compose up -d` on port 2345; the e2e app on port 3200).
- Clear `test-results/` at the start (evidence policy); R11 evidence lives under `test-results/r11-content/` and the e2e test directories.

### Intent

Five independent content and admin improvements from Paul's 2026-10-01 regression feedback. The only coupling is 64 → 65: once the editor is the single place a video goes, the separate Video links field and its column can go, with existing links moved into the body.

### Human gate H0 (blocks D64 only): image upload

Ticket 64 says images "can be uploaded (Vercel Blob, from ticket 60)". R10 shipped without Blob: Paul's 2026-10-02 scope change on ticket 60 says "pictures should just be urls, we don't want or need blob storage at this time" and that uploads "move to Blob later, with AI-edited portraits". There is no Blob store, dependency, env var or upload route on `staging`. The epic's "Blocked by: R10 (Blob storage for image upload)" no longer holds. Paul picks one before D64 starts:

- **A (recommended): images by URL only in R11.** Matches the R10 decision and journeys itself (journeys' editor has no upload either). 64-AC2's "uploaded captioned image" becomes "a captioned image added by URL". Upload returns with Blob in a later ticket. No new dependency, env var, provisioning or privacy change. Record as `[SCOPE CHANGE]` on ticket 64 and the epic.
- **B: add Vercel Blob in D64.** Adds `@vercel/blob`, `BLOB_READ_WRITE_TOKEN` in `.env.example`, a Blob store provisioned by Paul on the Vercel project (human prerequisite), an Organizer/Host-only client-upload route (`handleUpload` with `authorize`, content types JPEG/PNG/WebP/GIF, size cap), the sanitizer still accepting only absolute https image URLs, Privacy and Terms updated, a CI secret or a test double for e2e (CI has no Blob), and a staging human check of a real upload. Adds roughly a deliverable and a human gate; plan B's steps would be written as a revision of this plan.

Everything below assumes **A**. Under B, D64 gains the upload steps above and the verification map gains a staging upload row.

### Resolved decisions

#### Editor parity (64)

**E1. Content set.** `src/lib/rich-text/content.ts` grows to journeys' set (`../journeys/src/lib/graph/content.ts`) plus video:
- marks: bold, italic, **underline**, **strike**, link;
- inline: text, **hardBreak**;
- blocks: paragraph, heading (1–6 stored, coerced), **blockquote** (top level only, paragraphs only), bullet and ordered lists (list items hold paragraphs and lists only), image with `src`, `alt` and **`caption`** (top level only), video (top level only).
- Existing stored content stays valid: `caption` is optional on read and defaults to `""`; nothing stored is rewritten. The write sanitizer (`contentInputSchema`) and the render sanitizer (`RichText`) are the same function, so both grow together. A blockquote or image or video found inside a list item is dropped (as journeys does); a heading or list inside a quote has its paragraphs kept and the rest dropped, per journeys' `sanitizeBlockquote`.
- `isBlankContent` treats a hardBreak-only paragraph as blank; images, videos and quotes with text are not blank.
- `toPlainText` (MCP) renders a quote's lines prefixed `> `, a hardBreak as a newline, an image's caption as its own line when present (images otherwise dropped, as now), a video as its URL.

**E2. Extensions.** Port `../journeys/src/lib/rich-text/extensions.ts`: `QuoteDocument` (`(block|quote|figure)+`), `ParagraphQuote`, `CaptionedImage` with `insertImage` and `replaceLiftingImages`. Keep this repo's `Video` node, moved into the `figure` group so it can't land in a list item or quote; `replaceLiftingImages` lifts every node in the `figure` group (image and video), so `insertImage` and a new `insertVideo` command place both the same way. Link keeps `autolink: false` (this repo's reason stands). Export `editorExtensions` only (this repo renders with React, not TipTap, so journeys' `richTextExtensions` and `draftEditorExtensions` are not ported). `placeholder.ts` and `shortcuts.ts` are copied verbatim with imports pointed at `@/lib/rich-text/content`.

**E3. Editor UI.** `src/components/rich-text-editor.tsx` takes journeys' toolbar: H1–H3, bold, italic, underline, strike, quote, bullet list, ordered list, link, image, video; each with a Tooltip naming it and its shortcut (`formatShortcut`, platform read once after mount); the image tools BubbleMenu (`@tiptap/react/menus`, already installed transitively) with Edit and Remove on a selected image; the image dialog with URL, alt text and "Caption (optional)"; an optional `placeholder` prop. Link, image and video dialogs use shadcn `Dialog`; the Tooltip, BubbleMenu and Dialogs portal into the themed root through `ThemeRoot` (CLAUDE.md UI rule) (they open from inside `ResponsiveSheetDialog`; Base UI nests them). Add shadcn Tooltip with `pnpm dlx shadcn@latest add tooltip`. Placeholders: Announcement body "Write the Announcement…", FAQ answer "Write the answer…", Schedule Item description "Add details (optional)…".

**E4. Heading levels in the viewer.** `RichText` normalises headings the way journeys' runner does (first stored heading renders at the floor, each later one at most one deeper than the previous, clamped to 6), with a `headingFloor` prop (default 2) because this repo renders rich text at three depths. Call sites pass one below their nearest enclosing heading: the Announcement card (its title's level, checked by the implementer on `/[edition]/announcements` and Home), the FAQ answer (3, under the `h2` question), the Schedule Item description (4, under the `h3` title). Size classes cover h2–h6. `[&_figcaption]`, `[&_blockquote]` styles come from journeys.

**E5. Tests ported.** `extensions.test.ts`, `insert-image.test.ts` (plus a video-lifting case), `placeholder.test.ts`, `shortcuts.test.ts` from journeys, adapted to this repo's imports; `content.test.ts` gains: every new mark/node survives sanitize; unknown marks/nodes are stripped; a quote holding a heading keeps only paragraphs; an image inside a list item is dropped; an old image with no `caption` reads as `caption: ""`; `toPlainText` cases. New devDependencies: `happy-dom` (the editor tests use `// @vitest-environment happy-dom`) and `@tiptap/html` pinned to the installed TipTap version (3.31.3), test-only.

#### Videos in the body (65)

**V1. Migration.** Two migrations, in this order, per the maintainer's guide rule ("a data step that the schema diff can't express … `pnpm db:generate --custom --name`"):
1. `pnpm db:generate --custom --name announcement-videos-into-body`, holding only:
   ```sql
   UPDATE "announcement" SET "body" = jsonb_set("body", '{content}',
     coalesce("body"->'content', '[]'::jsonb) || (
       SELECT jsonb_agg(jsonb_build_object('type','video','attrs',jsonb_build_object('src', u)) ORDER BY o)
       FROM unnest("video_urls") WITH ORDINALITY AS t(u, o)))
   WHERE cardinality("video_urls") > 0;
   ```
2. Remove `videoUrls` from `src/db/schema.ts`, then `pnpm db:generate --name drop-announcement-video-urls` (the generated `ALTER TABLE "announcement" DROP COLUMN "video_urls";`, unqualified as in `0005_drop_standings_hidden`). Never hand-edited.

Existing links already passed `videoUrlSchema` (allow-listed, embeddable), so every appended node passes the sanitizer.

**V2. Migration test.** `src/db/migrations.test.ts` (local Postgres only, `describe.skipIf(!isLocalDatabase)`, inside `inRolledBackTransaction`): creates schema `r11_migration_test`, `set local search_path` to it, creates a minimal `announcement` table (`id uuid`, `body jsonb not null`, `video_urls varchar(500)[] not null default '{}'`), inserts one row with a paragraph body and two links and one row with none, then executes the two committed migration files' statements (read from `drizzle/` by their fixed tags `…_announcement-videos-into-body` and `…_drop-announcement-video-urls`, split on `--> statement-breakpoint`). Asserts: row 1's body ends with two video nodes in link order after the paragraph; row 2's body is unchanged; `information_schema.columns` has no `video_urls` for that schema. Rolled back.

**V2a. Real-data migration run.** Before D65's migrations exist, on local Postgres at the old schema with the seeds loaded (the XI demo Announcement has `video_urls = {https://www.youtube.com/watch?v=vKQi3bBA1y8}`), check out D65 and run `pnpm db:migrate` (no reseed), then `psql` shows that Announcement's `body->'content'` ending with that video node and `video_urls` gone from `information_schema.columns`. Output saved to `test-results/r11-content/migration-real-data.txt`.

**V3. Seeds: rewritten, and old seeds refused, not silently converted.** `seeds/demo/xi.json`'s one link moves to the end of that Announcement's body as a video node; `seeds/demo/xii.json` loses `"videoUrls": []`. The seed schema replaces `videoUrls` with a field that refuses any value: "videoUrls is gone; put each video in body as a video block". zod would otherwise strip the unknown key and lose the video silently. No seed loader conversion: seeds are in this repo and change with the migration (team policy). Seeded Announcements are insert-only (`onConflictDoNothing`), so already-loaded rows are moved by the migration, not the reload.

**V4. Code removal.** `videoUrls`, `videoUrlSchema` and `MAX_VIDEO_LINKS` go from `src/lib/announcements.ts`, the form (`announcement-form.tsx`: the Video links list and "Add video link"), the mutation, the admin edit page, the query, `announcement-card.tsx` (renders only the body), MCP `get_announcements` (the field goes; the body's plain text already carries each video URL), smoke (`announcements.ts`, `hosts.ts`, `mcp.ts`: the MCP check asserts the XI demo Announcement's body text includes the YouTube URL), `e2e/regression-r5.spec.ts` (its `video_urls` query and insert), the comment in `src/lib/form-errors.ts`; the smoke case posting an evil video host becomes a body-video-node sanitizer case (the node is stripped); unit tests (`src/lib/announcements.test.ts`, `src/mutations/announcements.test.ts`, `src/actions/announcements.test.ts`, `mcp/announcements.test.ts`, `seed/schema.test.ts`, `seed/seeds.test.ts`: the XI demo assertion becomes "an Announcement body holds a video node"). `videoEmbedUrl` stays (the video node uses it).

**V5. Deploy window (human gate H1).** On merge to `staging`, `migrate.yml` drops the column while the previous deployment may still be serving. Drizzle selects `video_urls` by name, so every Announcement read or write on the old deployment fails until the new deployment is live. This happens on staging, and again on production at the `staging → main` promotion. Unlike R10's migrations, which only added things, a column drop is destructive and can't be undone. Paul picks:
- **H1-a (default in this plan):** accept a few minutes of failing Announcement pages at each merge, with merge and promotion timed outside War Week. Single PR, 65-AC1 as written.
- **H1-b:** split the change. R11 ships the data migration and the code removal (the column stays, unread, default `{}`), and a follow-up PR drops the column after production runs the new code. Needs a `[SCOPE CHANGE]` on 65, because its AC1 expects "no column".

#### Day description (66)

**Y1. Column.** `day.description varchar(280)` nullable; schema then `pnpm db:generate`. Run after D66 lands before D65's migrations (both in wave 2; order D66 → D65).

**Y2. Rule.** `daySeedShape` gains `description: z.string().trim().max(280).nullish()`, with `""` stored as null by the loader, as the form does; the Day form schema (`daySchema` in `src/lib/setup.ts`) takes it trimmed, empty → `null`, over 280 → "Description: must be at most 280 characters" (the existing label rule; label "Description"). Plain text only.

**Y3. Writes.** `createDay` / `updateDay` write it; the seed loader inserts it and, like `dayTheme`, updates it on reload (`excluded.description`), so seeds stay the owner of seeded Days' fields and a reload is idempotent.

**Y4. UI.** The Day form (`days-editor.tsx`) adds a Textarea "Description (optional)" under Day Theme with a live "n/280" hint and `maxLength=280`. The Days list row details stay `Day Theme · usage`. `/[edition]/schedule` shows the description under the Day Theme line as `text-foreground/70`, only when set. Home's Now/Next "Today" header shows it under the Day Theme (one line, wraps). Not added to MCP `get_schedule` (no named need; prefer not adding).

**Y5. Not copied.** `createNextWarWeek` doesn't copy Days; nothing changes there.

#### Roster import (67)

**R1. Pure module `src/lib/roster-import.ts`** (vitest, no DB):
- `parseRosterText(text)`: tab-separated if any line has a tab, else CSV (RFC 4180: quoted fields, `""` escapes, commas and newlines inside quotes, CRLF). Trims cells, drops blank lines.
- `mapColumns(rows, { leaderTitle })`: the first row is a header when at least one cell matches a header synonym (case- and punctuation-insensitive) and no cell in it is an email. Synonyms: name ← name, full name, display name, participant, your name; email ← email, email address, work email; team ← team, team name; company tag ← company, company tag, tag; leader ← leader, captain, is leader, the War Week's Leader Title. Unknown headers (e.g. a Google Form's Timestamp) are ignored. Without a header: name, email, team, company tag, leader by position.
- `planRosterImport({ rows, columns, roster, teams, mode })` → one entry per data row: **Add**, **Update** (with a `changes` list, e.g. "Team: Red → Blue"), **Unchanged** (an Update with no changes, shown and skipped), or **Error** with a reason. Rules:
  - Email optional; when present it's lowercased and must parse (`emailSchema`), and is matched against this War Week's roster ignoring case. No email → Add.
  - Field rules reuse `parseParticipantInput` (name 1–120, company tag ≤40, leader needs a Team); its first error is the row's Error.
  - Team by name, case-insensitive, among this War Week's Teams; unknown → Error "No Team named "X"." (never created). Free-for-all: team and leader columns ignored.
  - Leader cell truthy: yes, y, true, x, 1, ✓, leader, captain, or the Leader Title (case-insensitive); anything else false.
  - Errors also for: a duplicate name (another roster row, other than the one this row updates, or an earlier row in the file); a duplicate email within the file; an Update that changes the Team of a Participant who is in a Squad ("In a Squad; change their Team on the roster after removing them from its Squads").
  - A column absent from the file leaves that field unchanged on Update and default on Add. A present but empty cell clears it (company tag, team, leader), so an Update can take someone off their Team. The preview labels that change prominently ("Team: Red → none"). This rule is human gate H2: Paul confirms it, or empty cells mean "unchanged".
  - Name matching (within the file and against the roster) ignores case and surrounding spaces. That's stricter than the database's case-sensitive unique constraint, so the import never creates two names that differ only in case.
- Limit: 500 data rows, else one file-level error. The CSV file and the pasted text are capped at 256 KB, under Next's 1 MB server-action body limit.

**R2. Write.** Server action `importParticipants(warWeekId, { text, expected })` in `src/actions/setup.ts` via `setupWrite("participant.import", "warWeek", …)`. New Organizer-only action `participant.import` ("import Participants") in `src/lib/access.ts`. Mutation `importParticipants` in `src/mutations/setup.ts`: one transaction; locks this War Week's participant rows (`for update`), reloads roster, Teams and Squad membership, re-runs the same `planRosterImport` on the posted text, and refuses with "The roster changed since the preview. Review it again." if the recomputed plan differs from `expected`. `expected` holds each row's number, kind and changes, not just the row numbers. Then inserts Adds and updates Updates (Error and Unchanged rows skipped) in that transaction; a unique violation becomes `PARTICIPANT_TAKEN` via `refusingDuplicate`. Returns counts for the toast ("Imported 2 new, updated 1.").

**R3. UI.** On `/admin/roster`, the Participants list header gets **Import** next to Add, opening `ResponsiveSheetDialog` "Import Participants": a Textarea "Paste from Google Sheets" and a file input "Or upload a CSV" (`.csv,text/csv`, read client-side with `File.text()`, ≤256 KB), a one-line column hint naming the expected order. **Preview** shows a summary ("2 to add, 1 to update, 0 errors") and a list (cards on phones, a table at `md`), each row badged Add / Update / Unchanged / Error with its changes or reason. **Import** (disabled when nothing to add or update) commits; on success a sonner toast, the sheet closes, the roster refreshes. Roster and Teams for the preview come from the page's existing setup queries (plus a Squad-membership flag on `getSetupParticipants`).

#### Unstart (68)

**U1. Rule (pure, `src/lib/war-week-lifecycle.ts`).** `LifecycleAction` gains `"unstart"`. `lifecycleActionError` takes an optional `scored: { pointsEntries: number; heatResults: number; games: number }` and for Unstart returns, in order: not live → "Only a live War Week can be unstarted."; `pointsEntries > 0` → "Points have been entered; Unstart isn't available."; `heatResults > 0` → "A Heat has a result; Unstart isn't available."; `games > 0` → "A Game has been logged; Unstart isn't available."; else null. `transitionError` allows `live → upcoming` (the old blanket "can't go back to upcoming" becomes: `complete → upcoming` refused with that message). A Heat result is a Heat in this War Week's Competitions with status `played` or `forfeit`; a Game is any `game` row in its Competitions; a Points Entry is any `points_entry` of the War Week.

**U2. Action and lock.** `unstartWarWeek(warWeekId)` in `src/actions/war-week-lifecycle.ts`: `authorize("lifecycle.unstart", …)` (new Organizer-only entry "unstart a War Week"), counts, `lifecycleActionError`. Mutation `unstartWarWeek(ctx)` goes through `transition(…, "upcoming", …)` with the counts re-read inside the transaction after the `for update` lock and the same rule re-checked. Points, Heat and Game writes don't lock the War Week row and aren't status-gated, so a write racing Unstart leaves an upcoming War Week holding a score, a state Start→score already allows; no invariant breaks. `revalidateSite()` on success.

**U3. UI.** The Lifecycle box on `/admin/settings` shows **Unstart** beside End while live, behind `ConfirmDialog` ("Unstart War Week XII? It goes back to Upcoming. Only possible while nothing has been scored."; the current War Week is still picked from status, so an unstarted edition stays current when nothing else is live); refusals as sonner toasts. The box adds the ticket's line "Live makes this the War Week everyone lands on. Nothing is hidden before then." verbatim. The red-team noted it is only partly true when nothing is live (an upcoming edition is already current then). That's a copy question for Paul, recorded under H-questions, not a gate. The organizer guide (`organizer-guide.tsx`) names Unstart beside Start, End and Reopen. Smoke `hosts.ts` organizer-only table and `lifecycle.ts` gain Unstart cases.

### Deliverables and waves

| Deliverable | Wave | Isolation | Owns |
|---|---|---|---|
| D64 editor | 1 | worktree | `src/lib/rich-text/*`, `src/components/rich-text-editor.tsx`, `src/components/rich-text.tsx`, its call sites' `headingFloor`/`placeholder`, `src/components/ui/tooltip.tsx`, `package.json`/lockfile (happy-dom, @tiptap/html), `e2e/regression-r11-editor.spec.ts` |
| D67 import | 1 | worktree | smoke `hosts.ts` organizer-only case for `importParticipants`, `src/lib/roster-import.ts`(+test), `src/mutations/setup.ts` import fn(+test), `src/actions/setup.ts` import action, `src/lib/access.ts` entry, roster UI (`teams-editor.tsx` / new `roster-import.tsx`), `src/queries/setup.ts` Squad flag, `e2e/regression-r11-roster-import.spec.ts` |
| D68 Unstart | 1 | worktree | `src/lib/war-week-lifecycle.ts`(+test), `src/mutations/war-week-lifecycle.ts`(+test), `src/actions/war-week-lifecycle.ts`, `src/lib/access.ts` entry, `war-week-lifecycle-controls.tsx`, `admin/settings/page.tsx` copy, `organizer-guide.tsx`, smoke `lifecycle.ts`/`hosts.ts`, `e2e/regression-r11-unstart.spec.ts` |
| D66 Day description | 2a | feature branch | `src/db/schema.ts` day, its migration, `src/lib/setup.ts` day shapes, `src/mutations/setup.ts` day fns, `src/seed/load.ts` days, `days-editor.tsx`, schedule page, `now-next.tsx` + its query, smoke `setup.ts`, `e2e/regression-r11-day-description.spec.ts` |
| D65 videos into body | 2b | feature branch | `src/db/schema.ts` announcement, both migrations, `src/db/migrations.test.ts`, seeds, seed schema/loader/tests, announcements lib/form/mutation/query/card/admin page, MCP, smoke, `e2e/regression-r5.spec.ts` |
| DX docs | 3 | feature branch | `CONTEXT.md` (Announcement "rich text (videos included)"; Day description; lifecycle Unstart rule replacing "There's no way back to `upcoming`"; roster import), `docs/maintainers-guide.md`, `docs/regression-checklist.md` (Announcements: heading, quote, captioned image, video, shortcuts hint; Schedule: Day description; Roster: Import with Add/Update/Error; Lifecycle: Unstart; MCP `get_announcements` without videoUrls), `/about` copy where these features appear, and a decision on whether the `scripts/about-media.ts` stills "announcements" and "schedule" need regenerating (regenerate them if the editor's or the Schedule's look changed), ticket closeouts |

`src/mutations/setup.ts` is touched by D67 (wave 1) and D66 (wave 2): sequential, no conflict.

### Fixtures and accounts

- Local Postgres from `docker compose up -d`; e2e signs stub sessions (`asOrganizer`, `E2E_ORGANIZER_EMAIL`); no Google.
- 64 e2e: image by URL served by the app itself (an existing file under `public/`, absolute `http://localhost:3200/...`), so no external network; video `https://youtu.be/dQw4w9WgXcQ` (asserted by iframe `src`, not playback). Creates its Announcement with a unique title; deletes it in `finally`.
- 66 e2e: edits an existing seeded Day of the live demo edition through the Day form, asserts on `/<edition>/schedule`, restores the description to null in `finally` (SQL).
- 67 e2e: on the live demo edition (XI demo), first gives the seeded Participant "Ian Ballard" the test-only email `e2e-r11-import@jahnelgroup.com` with `withParticipantEmail` (`e2e/db.ts`). Then pastes three rows: two new names unique per run, and that email with company tag "R11". Asserts the preview (2 Add, 1 Update), imports, and asserts the roster. `finally` deletes the two new rows and restores Ian Ballard's email and company tag to their seeded values (SQL). No real employee email is used.
- 68 e2e: uses the locally seeded, never-started XII (`seeds/xii.json`, `upcoming`, nothing scored). It remembers the live edition (XI demo) and sets it `complete` by SQL. It selects XII in the admin switcher, Starts and Unstarts it through the UI confirms, and asserts "Upcoming". `finally` sets XII back to `upcoming` (if still live), then restores the remembered edition to `live`, in that order so `war_week_one_live` holds. (Playwright runs one worker, serially; `--reset` reseeding restores both on the next run anyway.)
- Migration test: temp schema in a rolled-back transaction; nothing persists.

### Verification map

- **Run surface:** local (production build + local Postgres). Staging appears only in the post-merge row.
- **Evidence:** under `test-results/` (cleared first), committed.
- **Gate:** `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate`.
- **Viewports:** 1440×900 and 390×844 for every screenshot AC.

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 64-AC1 ported tests | `pnpm test src/lib/rich-text` | extensions, insert-image (+video lift), placeholder, shortcuts, content pass | vitest output `r11-content/unit-rich-text.txt` | W1 D64 | extensions, content, sanitizer |
| 64-AC1 sanitizer | `pnpm test src/lib/rich-text/content.test.ts` | every new mark/node kept; unknown stripped; old image without caption valid | vitest | W1 D64 | content.ts |
| 64-AC2 e2e | `pnpm e2e e2e/regression-r11-editor.spec.ts` | Organizer posts via toolbar: H2 heading, quote, image by URL with caption (under H0=A), video; `/<edition>/announcements` shows a heading element, `blockquote`, `figure > img + figcaption` with the caption, `iframe[src*=youtube]`; tooltip shows a shortcut hint | screenshots `regression-r11-editor-*/{1440,390}.png` | W1 D64 | editor, viewer, form |
| 64 image tools + placeholder | same e2e: the empty editor shows the placeholder; selecting the image shows the tools menu, Edit changes the caption, Remove deletes it from a second image | screenshot `regression-r11-editor-*/image-tools.png` | W1 D64 | editor |
| 64 heading floor | unit test on `RichText` normalisation | first heading at `headingFloor`, no skipped level | vitest | W1 D64 | rich-text.tsx |
| 64 axe | existing `e2e/axe.spec.ts` in gate | no new violations | e2e | W1 integration | viewer markup |
| 65 real-data migration (V2a) | `pnpm db:migrate` on seeded local Postgres at the old schema, then `psql` | the XI demo body ends with the video node; no `video_urls` | `r11-content/migration-real-data.txt` | W2 D65 | either migration file |
| 65-AC1 migration | `pnpm test src/db/migrations.test.ts` | two links → two trailing video nodes in order; no column | vitest | W2 D65 | either migration file |
| 65-AC2 seeds twice + smoke | `pnpm smoke` | both loads pass; MCP `get_announcements` body text has the XI video URL; no `videoUrls` key | smoke `r11-content/smoke.txt` | W2 D65 | seeds, loader, MCP |
| 65 seed refusal | `pnpm test src/seed/schema.test.ts` | a seed carrying `videoUrls` fails with the move-to-body message | vitest | W2 D65 | seed schema |
| 65-AC3 no field | `rg -n "Add video link\|videoUrls\|video_urls" src scripts e2e seeds` | no hits outside `drizzle/` | command output in closeout | W2 D65 | any |
| 66-AC1 migration + seeds | `pnpm smoke`; seed schema test with and without `description`, 281 chars refused | nullable column; seeds load twice | smoke; vitest | W2 D66 | schema, seed |
| 66-AC2 e2e | `pnpm e2e e2e/regression-r11-day-description.spec.ts` | saved description shows under the Day on `/<edition>/schedule` and in Home's Today header when that Day is today (`?at=`) | screenshots at both viewports | W2 D66 | form, schedule page, now-next |
| 67-AC1 unit | `pnpm test src/lib/roster-import.test.ts` | TSV, CSV with quoted commas, header and headerless, Google Form headers, case-insensitive email update, each Error kind (bad email, unknown team, duplicate name in file and roster, duplicate email in file, leader without team, Squad team change), free-for-all ignores team/leader, absent vs empty column, 500-row cap | vitest | W1 D67 | module |
| 67 write | `pnpm test src/mutations/setup.test.ts` (import cases, local DB) | commits Add+Update in one transaction; stale `expected` refused, nothing written | vitest | W1 D67 | mutation |
| 67 access | `pnpm test src/lib/access.test.ts`; smoke `hosts.ts` calls `importParticipants` over HTTP as a Host and as a Participant | `participant.import` Organizer-only; both refused "Only an Organizer can import Participants.", nothing written | vitest; smoke | W1 D67 | access.ts, action |
| 67-AC2 e2e | `pnpm e2e e2e/regression-r11-roster-import.spec.ts` | preview 2 Add, 1 Update; after Import the roster shows them | screenshots at both viewports | W1 D67 | UI, action |
| 68-AC1 unit | `pnpm test src/lib/war-week-lifecycle.test.ts src/lib/access.test.ts` | allowed with nothing scored; refused with a Points Entry, a Heat result, a Game; refused for non-Organizers and non-live | vitest | W1 D68 | lifecycle rule, access |
| 68 lock | `pnpm test src/mutations/war-week-lifecycle.test.ts` | a Points Entry inserted after the action's check is caught by the in-transaction re-check | vitest | W1 D68 | mutation |
| 68-AC2 e2e | `pnpm e2e e2e/regression-r11-unstart.spec.ts` | fresh edition Start → Live, Unstart → Upcoming | screenshots at both viewports | W1 D68 | UI, action |
| Epic: seeds and migrations together | `pnpm smoke` on seeded local Postgres | pass | smoke output | W2 | any schema/seed |
| Epic: docs | diff review of `/about`, maintainers guide, checklist, CONTEXT.md | each feature named | PR diff | W3 | — |
| Epic: gate | full gate, final | exit 0 | `r11-content/gate-final.txt` | each wave; final | any |
| Epic: closeouts | each ticket file 64–68 has `[CLOSEOUT]` and `Status: done` in the PR's last commit | present | PR diff | final | — |
| Epic: CI | `gh pr checks <PR>` | green | PR URL in closeout | after PR | any push |
| Post-merge staging (human, not a DoD row) | Prereq: merge to `staging`, `migrate.yml` green. Action: Paul opens staging `/<live edition>/announcements`. Post-check: any Announcement that had video links shows them at the end of its body | videos present | Paul's note on the epic | after merge | migration |

### Human gates and questions

- **H0** (answered 2026-10-02, Paul): **A**, images by URL only in R11. Recorded as `[SCOPE CHANGE]` on ticket 64 and the epic.
- **H1** (answered 2026-10-02, Paul): **H1-a**, accept the window. Drop the column in ticket 65; time the merge to `staging` and the `staging → main` promotion outside War Week. 65-AC1 stands as written.
- **H2** (answered 2026-10-02, Paul): an empty cell **clears** the field; the preview labels the change prominently.
- Copy question (not blocking): the ticket 68 Lifecycle-box line is kept verbatim unless Paul rewords it.
- No other human prerequisites under A.

### Exclusions

- No image upload or Blob (under A).
- No Day description in MCP or in seeds' real (non-demo) files beyond schema acceptance.
- No roster import of Teams (unknown Team is an error), no delete-by-omission, no import into a War Week other than the selected one.
- No custom Finale slides (ticket 74 reuses the editor later).
- No change to `Create next War Week`.

### Red-team

Round 1 (2026-10-02, fresh `atlas-red-team-reviewer`): **PASS**, 0 blocking, 5 should-fix, 13 nits. Folded in:
- S1: the Unstart confirm copy was wrong about which edition becomes current; rewritten.
- S2: the deploy window was justified by a false comparison with R10; it is now human gate H1.
- S3: added the real-data migration run (V2a).
- S4: added a smoke check that Hosts and Participants are refused the import.
- S5: the e2e fixtures are named, and no real employee email is used.
- Nits: the drop migration gets a fixed name; the schema-qualified fallback is gone; the removal list is complete; Unstart uses the seeded XII; the size cap is 256 KB; the Postgres port is corrected; rows added for closeouts and image tools; empty seed descriptions are stored as null; popups portal through ThemeRoot; the empty-cell rule is H2; the stale-preview check compares kinds and changes; name matching ignores case; `/about` stills are covered; the access-control trigger is named.

## [PROGRESS]

- 2026-10-02: claimed epic and tickets 64–68; branch `feat/regression-r11-content` from `staging` at `2c8fcc3`; `test-results/` cleared. Wave 1 (D64, D67, D68) dispatched to worktrees under `.claude/worktrees/regression-r11/war-weeker/`.
- 2026-10-02: wave 1 integrated at `565ca74`. D68 (Sonnet), D64 (Opus), D67 (Opus) accepted. Orchestrator fixes: the Unstart confirm no longer repeats its title; a short CSV row leaves its missing cells unchanged instead of clearing them (new unit case); a selected image or video is kept when another is inserted after it (the editor e2e caught the Video control replacing the image just inserted; new unit case). Candidate evidence: format, typecheck, lint, unit (3418 tests), build, smoke (import and Unstart refusals, lifecycle Unstart) and the three new e2e specs, under `test-results/r11-content/w1-*`. Predicted conflicts in `access.ts` and `hosts.ts` didn't happen: both cherry-picks applied cleanly.
- 2026-10-02: wave 2 integrated at `5899990`. D66 (Sonnet) added `drizzle/0020_wild_speed.sql` (nullable `day.description`); its e2e passed. D65 (Sonnet) added `0021_announcement-videos-into-body.sql` (custom data step) and `0022_drop-announcement-video-urls.sql` (generated). V2a passed on the seeded local DB: the XI demo Announcement's body now ends with the video node and `video_urls` is gone (`test-results/r11-content/migration-real-data.txt`). The only remaining `videoUrls`/`video_urls` hits are in the migration test and the seed refusal. Orchestrator fix: r5 34's touch-target check measured the new link dialog mid zoom-in (0.96 scale); it now waits for animations to finish.
- 2026-10-02: aggregate code review (two fresh Opus reviewers, one per axis), then review fixes (Opus, `de713eb`) and one orchestrator fix (`b3cfdb3`). Final gate green at `b3cfdb3`.

## [AI CODE REVIEW]

2026-10-02, diff `2c8fcc3..8fd39a4`, then re-verified at `b3cfdb3`. Each axis was read by its own fresh reviewer; the orchestrator adjudicated every finding.

**Technical implementation and spec conformity**

| Finding | Severity | Disposition |
|---|---|---|
| F1 A headerless free-for-all paste read Company Tag as the ignored Team column (the hint said name, email, company tag) | blocking | Resolved: positional columns follow the mode; the hint matches; unit cases |
| F2 After "The roster changed since the preview" the preview re-planned against stale props | non-blocking | Resolved: the refusal refreshes the roster and clears the plan |
| F3 Reopen then Unstart sent an ended edition back to Upcoming with its Winner | non-blocking | Resolved: Unstart refuses an edition with a Winner ("This War Week has been ended; Unstart isn't available."). Residual: an edition ended with no Winner (nothing scored) can still be Reopened then Unstarted |
| F4 A Team deleted during an import gave a generic error | non-blocking | Resolved: a foreign-key violation refuses as a changed roster |
| F5 The `DayValues` comment said an omitted description is kept | non-blocking | Resolved: comment corrected |
| F6 Body videos all shared one iframe title | non-blocking | Resolved: `RichText` takes `videoTitle`; the card passes "Video: <title>" |
| F7 A seed reload overwrites a seeded Day's description | non-blocking | Resolved: noted in the maintainers guide (as with Day Theme) |
| F8 A heading in a list item showed in the editor but was dropped on save | non-blocking | Resolved: list items hold paragraphs and lists only in the editor too |
| F9 Ticket closeouts, statuses, stills decision | non-blocking | Resolved at closeout (below) |
| F10 Nits: error rows claimed names; TSV ignored quotes; no caps on video src and caption; a posted `videoUrls` was silently stripped | non-blocking | Resolved: all four, with unit cases |

**Coding standards**

| Finding | Severity | Disposition |
|---|---|---|
| S1 Same as F1 | blocking | Resolved |
| S2 Maintainers guide had no R11 rollout note and its expand/contract rule contradicted 0022 | blocking | Resolved: "Rolling out R11 (migrations 0020–0022)" section; the expand/contract bullet records H1-a as an approved exception |
| S3 Stale "Announcement video link" comments | non-blocking | Resolved |
| S4 Stale "(AC2)" smoke tag | non-blocking | Resolved |
| S5 Journeys vocabulary and ticket number in comments; spelling; test names | non-blocking | Resolved |
| S6 Editor dialogs dropped the shadcn Field components | non-blocking | Resolved: Field, FieldLabel, FieldDescription, FieldError |
| S7 Unstart's in-lock check passed a fake War Week | non-blocking | Resolved: pure `unstartError` |
| S8 The import action defined its own schema | non-blocking | Resolved: `rosterImportInputSchema` in lib |
| S9 Limits repeated as literals | non-blocking | Resolved: `DAY_DESCRIPTION_MAX`, size copy from `MAX_IMPORT_BYTES` |
| S10 Preview styling matched a message string | non-blocking | Resolved: structured changes with `cleared` |
| S11 roster-import nits | non-blocking | Resolved |
| S12 CONTEXT.md roster import in the wrong section; lowercase glossary terms | non-blocking | Resolved |
| S13 Duplicate insert commands; `replaceLiftingImages` name | non-blocking | Resolved: `insertFigure`, `replaceLiftingFigures` |
| S14 No demo Day description; stills decision unrecorded | non-blocking | Resolved: the XI demo's Sunday has a description (demo seed only; the history seed stays without one, orchestrator fix `b3cfdb3`); stills decision below |
| S15 Counter was a hand-built live region | non-blocking | Resolved: `FieldDescription` |
| S16 Type, style and wrap nits | non-blocking | Resolved |
| S17 R11 e2e naming and screenshot paths inconsistent | non-blocking | Resolved |

No open blocking findings.

## [CLOSEOUT]

2026-10-02. Branch `feat/regression-r11-content`, head `b3cfdb3` at verification; base `staging` at `2c8fcc3`.

**Deliverables**

| Deliverable | Commit | Worker |
|---|---|---|
| D68 Unstart | `bd27fb4` (picked `c61e47f`), orchestrator fix `dc5a3b8` | Sonnet |
| D64 Editor | `cd9c6b5` (picked `d30033c`), orchestrator fix `565ca74` | Opus |
| D67 Roster import | `27c1d45` (picked), orchestrator fix (short CSV rows) | Opus |
| D66 Day description | `0d44855` | Sonnet |
| D65 Videos into the body | `95b07c8`, orchestrator fix (r5 touch-target timing) | Sonnet |
| DX Docs | `8fd39a4` | Sonnet |
| Review fixes | `de713eb`, orchestrator `b3cfdb3` | Opus |

**Isolation check.** Wave 1 ran D64, D67 and D68 in parallel worktrees. The predicted shared files, `src/lib/access.ts` and `scripts/smoke/hosts.ts`, didn't conflict: both cherry-picks applied cleanly (adjacent single-line entries). D66 and D65 ran one after the other because both generate Drizzle migrations (0020, then 0021 and 0022); that ordering was required, not a prediction.

**About stills.** Not regenerated. The "announcements" still shows the about demo's feed, which has no headings, quotes, figures or videos in its body; the "schedule" still is Home's Now/Next at a time whose Day has no description in the about demo. Neither page changed visibly.

**Verified run command.** `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate` → exit 0 at `b3cfdb3`: unit 3433, build, smoke 233 ok and 0 not ok, e2e 83 passed (`test-results/r11-content/gate-final.txt`).

**Verdicts**

| Criterion | Verdict | Evidence |
|---|---|---|
| 64-AC1 ported tests; sanitizer keeps new marks/nodes, strips others | PASS | `src/lib/rich-text/*.test.ts`, `src/components/rich-text.test.tsx` (gate unit run) |
| 64-AC2 e2e: heading, quote, captioned image (by URL, per scope change), video render | PASS | `e2e/regression-r11-editor.spec.ts`; `test-results/e2e/regression-r11-editor-*/{1440,390,image-tools}.png` |
| 64 image tools, placeholder, shortcut hint | PASS | same e2e |
| 64 heading floor | PASS | `src/components/rich-text.test.tsx` |
| 65-AC1 migration test (two links → two trailing video nodes, no column) | PASS | `src/db/migrations.test.ts` (ran against local Postgres) |
| 65 V2a real-data migration | PASS | `test-results/r11-content/migration-real-data.txt` (migration files unchanged since) |
| 65-AC2 seeds twice; smoke | PASS | `gate-final.txt` (smoke reloads seeds `--reset` then plain; MCP body text has the XI video URL) |
| 65 seed refusal | PASS | `src/seed/schema.test.ts` |
| 65-AC3 no "Add video link" in `src/`; gate | PASS | `rg -n "Add video link\|videoUrls\|video_urls" src scripts e2e seeds` → only the migration test, the seed refusal and the posted-key refusal; `gate-final.txt` |
| 66-AC1 nullable column; seed schema optional description; seeds twice | PASS | `drizzle/0020_wild_speed.sql`; `src/seed/schema.test.ts`, `src/seed/load.test.ts`; smoke |
| 66-AC2 description on the Schedule (and Home's Today header) | PASS | `e2e/regression-r11-day-description.spec.ts`; `test-results/e2e/regression-r11-day-descrip-*/` |
| 67-AC1 unit (TSV, CSV, headers, update by email ignoring case, every error kind) | PASS | `src/lib/roster-import.test.ts` |
| 67 write (one transaction; stale preview refused) | PASS | `src/mutations/setup.test.ts` |
| 67 access (Organizer-only; Host and Participant refused over HTTP) | PASS | `src/lib/access.test.ts`; smoke `importParticipants as a Host/Participant is refused` |
| 67-AC2 e2e: 2 Add, 1 Update, imported | PASS | `e2e/regression-r11-roster-import.spec.ts`; `test-results/e2e/regression-r11-roster-impo-*/` |
| 68-AC1 unit (allowed unscored; refused with Points Entry, Heat result, Game; non-Organizer; non-live) | PASS | `src/lib/war-week-lifecycle.test.ts`, `src/lib/access.test.ts`; smoke lifecycle |
| 68 lock (re-check in the transaction) | PASS | `src/mutations/war-week-lifecycle.test.ts` |
| 68-AC2 e2e: Start then Unstart, Upcoming | PASS | `e2e/regression-r11-unstart.spec.ts`; `test-results/e2e/regression-r11-unstart-*/` |
| Epic: seeds and migrations together; smoke | PASS | `gate-final.txt` |
| Epic: `/about`, maintainers guide, checklist updated | PASS | PR diff (`src/lib/about.ts`, `docs/maintainers-guide.md`, `docs/regression-checklist.md`, `CONTEXT.md`) |
| Epic: closeouts, tickets `done` | PASS | this commit |
| Epic: format:check and gate | PASS | `gate-final.txt` |
| Epic: CI on the PR | pending | runs on the PR |
| Post-merge staging (human gate, not a DoD row) | BLOCKED until merge | Paul merges outside War Week, `migrate.yml` green, then opens staging `/<live edition>/announcements`: any Announcement that had video links shows them at the end of its body |

**Deviations and scope changes.** Images by URL only (H0=A, `[SCOPE CHANGE]` on 64). Column dropped in this PR (H1-a). Empty roster cell clears (H2). Added during review and recorded above: Unstart refuses an edition with a Winner; a posted `videoUrls` is refused; caps of 500 (video link) and 300 (caption); a short CSV row's missing cells stay unchanged; the Image and Video controls insert after a selected figure; new direct dependency `@tiptap/extension-list` (already installed through StarterKit). The XI demo's Sunday has a Day description; the history seed doesn't.

**Residual risk.** An edition ended with no Winner (nothing scored) can still be Reopened then Unstarted.
