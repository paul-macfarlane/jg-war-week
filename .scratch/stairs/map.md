# Map: Stairs integration

Wayfinder map for the Stairs epic. Tickets are the files in [`issues/`](./issues/); open tickets are found by scanning them, not listed here. Supersedes [Stairs app integration](../regression-2026-09/issues/19-stairs-integration.md).

## Destination

A spec for a continuous mirror of Stairs climbs into JG War Week, with a manual refresh, that gives Hosts enough climb data to score any year's stair Competition without anyone re-typing it, and matches people by email with a queue for the unmatched. Ready for `/to-spec` → `/to-tickets` → `/atlas-implement`.

## Notes

- **Need:** stop entering the same data twice. Stairs will probably be used for a War Week Competition; its climbs should flow into JG War Week rather than be retyped (Paul, 2026-09-30).
- **Stairs today:** `JahnelGroup/jg-stairapp-v2-frontend` (Vite + React, Firebase Hosting) and `JahnelGroup/jg-stairapp-v2-backend` (Express + Prisma + Postgres, Firebase Auth), cloned beside this repo. People are keyed by Jahnel Group email; guests are `guest-<name>`. Climbs are stored only as pre-aggregated totals per period (day, week, month, quarter, year, total), no per-climb events or timestamps.
- **Access:** Paul can talk to the Stairs owner and set up an integration, provided it's nothing too crazy. Changes to Stairs are PRs to its repos, agreed with its owner.
- **Direction:** read first, Stairs is the source of truth for climbs. The only write ever considered is logging climbs from JG War Week.
- **Scoring varies by year**, so the mirror supplies data, not one rule. Past rules: most climbs in the week; most in a time window; Team with the most climbs; Team with the most people over 111; the Team of the person whose 11th climb was logged 11th latest.
- **Matching:** email, ignoring case (as Account linking does); unmatched rows go to a Host queue to link or skip, never silently dropped.
- Skills: `grilling` and `domain-modeling` (see `CONTEXT.md`); follow `docs/agents/planning.md` and `docs/agents/testing.md` when a ticket reaches acceptance criteria.
- Never read `.env` files in any of the repos. A Stairs backend `.env` sits in its git history; flag rotation to the Stairs owner.

## Decisions so far

<!-- one line per resolved ticket: [title](link): gist -->

## Not yet specified

- **Logging climbs from JG War Week**: a Participant logs climbs without switching apps, written through to Stairs. Revisit once reading works.
- **Live standings during War Week**: a stair leaderboard or widget fed by the mirror, before results are final.
- **A general integration pattern**: whether Stairs and Beytopia share a shape. Only worth deciding once a second integration is real.

## Out of scope

- **Beytopia** (beyblade tracking): its own backlog ticket, [Beytopia integration](../beytopia/issues/01-beytopia-integration.md); owner, access and API unknown and the site is under maintenance.
