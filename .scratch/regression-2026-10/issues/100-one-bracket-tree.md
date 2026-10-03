# 100: One Bracket tree for admin and Participants

**What to build:** Admin and Participants see the same Bracket **tree**. Whoever runs the Competition (Organizer, Host, or a Participant self-reporting their Heat) taps a Heat in the tree to open its result form. Admin's round cards and the "Run results" link go; Participants lose the List/Tree toggle. On phones the tree scrolls sideways.

**Blocked by:** `97`, `98`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: run results naming, bracket display in admin; Participant: drop list view); grilling Q10, Q21

## Decisions

- Each recordable Heat in the tree carries a visible solid **Record result** (or **Edit**) button (`87`'s rule), not an invisible overlay.
- Highlight advancers per `84`.
- The Participant "your Heat" emphasis stays.
- The Finale's Bracket view is unchanged.

## Acceptance criteria

- [ ] e2e: an Organizer records a Heat from the admin tree; a self-reporting Participant records theirs from the public tree; no List toggle; screenshots at 1440 and 390 (sideways scroll).
- [ ] axe passes on the tree in both schemes.
- [ ] `pnpm gate` passes.
