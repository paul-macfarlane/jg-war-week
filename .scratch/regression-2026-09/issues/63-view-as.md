# 63: View as another person

**What to build:** An Organizer can **View as** a Participant (picked from the roster) or a Host (by email) and see the War Week pages and `/admin` exactly as that person: their nav, You highlight, Log a Game shortcut, admin trimmed to their Competitions. Every write is refused while viewing ("You're viewing as <name>; changes are off."). A banner on every page shows who you're viewing as, with **Exit view as**.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A2; grilling Q8, Q24

## Decisions

- Available in every environment, Organizers only. Started from the roster row and from `/admin/organizers` (or Settings; the plan decides), stored in a signed, httpOnly cookie scoped to the session.
- `getActor` returns the viewed person's actor with a `viewingAs` marker; `can` refuses every write when it's set, before any other rule. The real Organizer's identity is never lost (exiting restores it).
- Can't View as another Organizer. No audit log.
- Red-team (access change).

## Acceptance criteria

- [ ] Unit tests: `can` refuses every write action while viewing; reads follow the viewed actor.
- [ ] e2e: an Organizer views as a Host, sees only the Host's Competitions in admin, a Points Entry save is refused, Exit restores the Organizer view.
- [ ] `pnpm gate` passes.
