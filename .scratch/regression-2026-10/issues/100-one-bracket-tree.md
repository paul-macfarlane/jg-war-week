# 100: One Bracket tree for admin and Participants

**What to build:** Admin and Participants see the same Bracket **tree**. Whoever may record a Heat (an Organizer, the Competition's Host, or a Participant self-reporting their own Heat) taps it in the tree to open its result form. Admin's round cards (`bracket-results.tsx`) and the "Run results" link go; Participants lose the List/Tree toggle. On phones the tree scrolls sideways inside its own container; the page doesn't.

**Part of:** epic R17 (`../epics/R17-brackets.md`), one work package.

**Blocked by:** `97`, `99`, `98` (order inside R17)

**Status:** ai-review

**Source:** Paul's regression feedback 2026-10-03 (Admin: run results naming, bracket display in admin; Participant: drop list view); grilling Q10, Q21; red-team pass 1 W6, W7

## Decisions

- Each recordable Heat in the tree carries a visible solid **Record result** (or **Edit**) button (`87`'s rule), not an invisible overlay. A Heat the viewer can't record shows no button.
- Recording uses the existing server-side authorization; the tree hides buttons, it doesn't grant access.
- Highlight advancers per `84`. The Participant "your Heat" emphasis stays. The final and the 3rd place game are labelled per `98`.
- The Finale's Bracket view is unchanged except for `98`'s final rule.

## Acceptance criteria

- [ ] e2e: an Organizer records a Heat from the admin tree; a self-reporting Participant records their own Heat from the public tree; no List toggle exists.
- [ ] e2e: a Participant not in a Heat sees no **Record result** on it; with self-report off, a Participant in the Heat sees none; a Postgres action test shows both are refused server-side.
- [ ] e2e at 390: the tree container's `scrollWidth` > its `clientWidth`, and `document.documentElement.scrollWidth` ≤ the viewport width; screenshots at 1440 and 390.
- [ ] axe passes on the tree in both schemes.
- [ ] `bracket-results.tsx` and its tests are deleted; `grep -rn 'Run results\|BracketResults' src e2e` finds nothing.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r17`): claimed; `ready-for-agent` → `in-progress`. Execution record: [`R17-execution.md`](../epics/R17-execution.md).
