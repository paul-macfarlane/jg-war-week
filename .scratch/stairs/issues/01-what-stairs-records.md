# 01: What Stairs records, and does it need an event log?

**Type:** research

**Status:** resolved

**Blocked by:** none

## Question

What exactly does Stairs store today, and is it enough to score every past rule (see the map's Notes)? Stairs upserts pre-aggregated per-period totals (`Climbs` rows keyed `user.entity.period.startDate`), so there is no per-climb or per-entry timestamp. Establish:

- Which past rules the current data can score, and which need per-entry events with timestamps (e.g. "11th climb logged 11th latest"; "people over 111", per day or per week?).
- The smallest change to Stairs that would add an append-only entry log (and whether history can be backfilled; it can't be for timing).
- How guests, negative counts (corrections, -200..200) and the New York vs browser timezone split affect a mirror.
- Where the Stairs backend is hosted today and who owns it (code gives no deploy config; Paul to ask the owner).

Resolve with a recommendation to take to the Stairs owner.

## Answer

Researched 2026-09-30 against the Stairs repos at `df83e32` (backend) and `c8deefc` (frontend); key claims spot-checked.

### Findings

- Schema is two tables: `Users(id, entity, name, email, photo_url)` and `Climbs(id, climb_count, period, period_start_date TEXT, user_id)`. No timestamps anywhere (`backend/prisma/schema.prisma`).
- The only write is `POST /v1/climbs/me`. It upserts 12 rows in one transaction, incrementing six periods for the person and six for `jg`. Row ids look like `user.entity.period.YYYY-MM-DD` (`backend/src/routes/v1/climbs.route.ts`).
- `date` is chosen by the client and can be any day, so rows record the day climbs are credited to, not when they were logged. The custom form lets you edit a day's total, and the client sends the difference (`frontend/src/pages/Home.tsx:422`).
- There's no bulk read. `GET /v1/climbs/:user/:period` returns one user at a time, the leaderboard covers only the current period, and reports return the top 5. A mirror needs a new "all day rows in a date range" endpoint either way.

### Rule by rule

| Past rule | Scorable today? |
|---|---|
| Most climbs in the week | Yes. Sum the `day` rows over War Week's dates. Don't use `week` rows: they start on Sunday (`moment().startOf('week')`) and won't line up with War Week. |
| Most in a time window | Yes if the window is whole days. No if it's hours or minutes, which needs timestamps. |
| Team with the most climbs | Yes. Sum member `day` rows, once people are matched to Teams. |
| Team with most people over 111 | Yes, over the week (sum of days) or per day (a `day` row ≥ 111). The Host must say which. |
| Whose 11th climb was logged 11th latest | No. Needs ordered entries with a server `created_at`. One custom entry can add many climbs at once, so the 11th climb may fall inside a bulk entry. |

The backdating caveat applies to every rule: totals can change after the week ends, so the mirror needs a cut-off or freeze.

### Smallest Stairs change

Add one table and write it inside the existing `$transaction` in `POST /v1/climbs/me`:

```prisma
model ClimbEntries {
  id          String   @id @default(cuid())
  user_id     String   // subject: email or guest-<name>
  entity      String   // user | guest
  logged_by   String   // req.user_id (token email)
  climb_date  String   // YYYY-MM-DD credited day
  delta       Int      // -200..200
  created_at  DateTime @default(now())
  @@index([created_at])
  @@index([climb_date])
}
```

Then add `GET /v1/entries?since=<created_at>`, which returns entries in order for incremental sync, plus a range read for day rows. This needs no change to the frontend or to the existing rollups.

Backfill: seed one synthetic entry per existing `day` row. That keeps totals correct, but order and timing can't be recovered, so any timing rule only works from the day the log ships.

### Mirror gotchas

- **Guests** are `guest-<slug>` with an empty email, so they can never match by email. They go to the Host queue. Two spellings of one name create two people.
- **`guestId` isn't checked.** Any signed-in user can write under any `user_id`, and `POST /v1/users/createOrUpdate` upserts any id. If a guestId equals someone's email, their reads get polluted. Flag this to the owner.
- **Negative counts** are corrections, not climbs. Sum them in totals. For "Nth climb" rules, define whether a correction cancels earlier climbs. Zero is rejected (`!climb_count`), so there are no zero entries.
- **Timezones:** the quick-add button and "today" come from the browser (`moment().format` in `frontend/src/api.ts`). The leaderboard's current period is computed in `America/New_York`. Rows just store a date string. Store dates as-is (no timezone conversion) and define War Week days as NY dates.
- **Emails:** the id is the Google token email, used as sent. Match ignoring case.
- **No domain check:** neither repo restricts sign-in to `@jahnelgroup.com`. The mirror should only auto-match Jahnel Group emails.

### Hosting clues

- **Frontend:** Firebase Hosting, project `jg-stair-app-v2` (`frontend/.firebaserc`). It deploys through GitHub Actions on merge to `main` (`frontend/.github/workflows/firebase-hosting-merge.yml`). Both workflows run `cat .env`, which prints the build secrets into the CI logs.
- **Backend history:** it was AWS Lambda via Serverless (`serverless.yml`, `us-east-2`), deleted in `8bd9c26`. PR #3 "GCP Overhaul!" (`a2c4471`, 2024-08) brought in Postgres and Prisma. A `gcp-build` script appeared and was later removed, and the default is `PORT 8080`. That points to Google Cloud (App Engine or Cloud Run), probably inside the same Firebase/GCP project. There's no deploy config in the repo. I couldn't confirm this from the code.
- **People:**
  - Colby Beach wrote about 128 of the commits (the original author).
  - Frederich de Koker and Dom Favata are active in 2026. Frederich built the War Week XI team colours (hard-coded `TEAM_BY_UID`) and reverted them in `fe1d0c8`.
- **Secrets:** `.env` was committed in `8bd9c26`/`a2c4471` and deleted in `a8294b1`. It's still in history, so the database and Firebase credentials should be rotated.

### Recommendation

Ask Frederich (the current maintainer) and Colby to agree to three things:

1. Add the `ClimbEntries` log plus `GET /v1/entries?since=` and a date-range day-rows read, with a service credential for JG War Week.
2. Validate `guestId` (must start with `guest-`) and scope `createOrUpdate` to the caller.
3. Rotate the leaked credentials and stop `cat .env` in CI.

Until the log ships, JG War Week can score four of the five rules from `day` rows. The "11th climb" rule should wait for the log, or be dropped for War Week XII.

## Comments
