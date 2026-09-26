# 15: Post new Announcements to Slack

**What to build:** When an Organizer publishes a new Announcement in the app, War Weeker can also post it to the War Week's Slack channel through a Slack incoming webhook. This is a small, one-way integration. The PR ships **dormant**: with no webhook configured nothing changes. It switches on once IT provides the webhook URL in Vercel.

**Blocked by:** none (cut from the hackathon by Paul on 2026-09-24; pick it up only if time remains, else after Fri 2026-09-25 10:00 AM. The webhook itself waits on IT)

**Status:** ready-for-agent

## Decisions

Grilled 2026-09-24 with Paul.

- **Incoming webhook**, one channel. No Slack app, no bot token, no other notification types (Standings, Reveal, schedule reminders and Awards stay out). This reverses the spec's "Slack cross-posting: cut completely" for Announcements only.
- **Config:** a `SLACK_WEBHOOK_URL` env var (server-only, added to `.env.example` with an empty value). When unset or blank, the feature is off: no checkbox and no outbound calls.
- **Opt-in per Announcement:** the create form shows an "Also post to Slack" checkbox, ticked by default, but only when the webhook is configured.
- **Trigger:** only *creating* an Announcement through the app posts. Edits, deletes, pin changes and seed loads never post.
- **Message:** plain text, no TipTap-to-mrkdwn conversion beyond plain text:
  - `📣 War Week <Edition>: <title>` (bold)
  - a plain-text excerpt of the body: about the first 300 characters, cut at a word boundary, with `…` when truncated
  - any video links, one per line
  - `Read on War Weeker →` linking to `<BETTER_AUTH_URL>/<edition>/news` (no new base-URL variable)
- **Failure:** the Announcement always saves. If the Slack post fails (network error, non-2xx, or timeout of about 5 s), the Organizer sees "Published, but the Slack post failed" and the server logs the error, never the webhook URL. No retry.
- **Testing:** unit tests mock `fetch` and never hit Slack. The real-webhook check is human-gated (below).

## Acceptance criteria

- [ ] A pure module builds the Slack message from an Announcement (title, TipTap JSON body, video URLs), the Edition and the base URL. Unit tests cover the heading, the excerpt truncating at a word boundary with `…`, a short body left whole, rich text flattened to plain text (paragraphs, lists, links as their text), video links listed, and the news link.
- [ ] Creating an Announcement with the checkbox ticked and the webhook set sends exactly one POST to `SLACK_WEBHOOK_URL`. With the box unticked, or the env var unset, no request is sent. Covered by unit tests with a mocked `fetch`.
- [ ] Editing, deleting or pinning an Announcement, and `pnpm seed:load`, never send a request.
- [ ] If the POST fails or times out, the Announcement is still saved and the Organizer sees "Published, but the Slack post failed". The server log does not contain the webhook URL.
- [ ] With `SLACK_WEBHOOK_URL` unset, the Announcement form has no Slack checkbox and behaves exactly as before.
- [ ] `.env.example` lists `SLACK_WEBHOOK_URL=` with a one-line comment.
- [ ] The spec's Out of Scope line is updated so "Slack cross-posting" reads as cut except for new Announcements via webhook.
- [ ] `pnpm gate` passes.
- [ ] **Human-gated, after merge:** prerequisite: IT creates an incoming webhook for a test channel, and Paul sets `SLACK_WEBHOOK_URL` in Vercel and redeploys. Action: publish a test Announcement with the box ticked. Expected: one message with the format above appears in the test channel, and its link opens `/<edition>/news`. Post-check: delete the test Announcement, then point the variable at the real War Week channel. Record the result under Comments. Until then this criterion is `BLOCKED`, not `PASS`.

## Comments

- 2026-09-26: Now a phase 3 candidate in the post-hackathon plan (`.scratch/hardening/issues/17`). It ranks first if IT provides the webhook by January 2027.
