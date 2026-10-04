# 52: Remove "Which one is you?"

**What to build:** Delete the `YouPicker` on the Teams page, the `ww:you:<edition>` device pick and the `via: "pick"` branch of `resolveYou`: You is found by account linking only. Participant email stays optional; the roster admin shows a quiet hint on rows without an email ("No email: won't be linked when they sign in").

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P7; grilling Q6

## Decisions

- Leftover `ww:you:*` keys in `localStorage` are harmless; clear them on load if trivial, else leave them.
- Update CONTEXT.md (**You**, **Account linking**, Access rules mentions of the pick), Privacy if it mentions the device pick, and the maintainer's guide.

## Acceptance criteria

- [x] No "Which one is you?" in `src/`; `resolveYou` has no pick branch; its tests updated.
- [x] A Participant linked by email is still highlighted (existing e2e passes).
- [x] The roster shows the missing-email hint; screenshot at both viewports.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Worker D52 (Sonnet), commit a243deb, plus orchestrator smoke fix 589482c and review fixes b74876b.
  - AC1 PASS: `grep -rn "Which one is you" src` is empty. `resolveYou` has no pick branch, and `you.test.ts` covers account linking only.
  - AC2 PASS: linked-Participant e2e (`bracket.spec.ts`, `bracket-heats.spec.ts`, `games.spec.ts`) and smoke "linked by email sees one 'You'" are in `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`). The e2e helper now links by email and restores the original email.
  - AC3 PASS: test-results/r8-quick-fixes/roster-email-hint-1440/, -390/. On XI, 100 of 101 Participants show "No email: won't be linked when they sign in"; the one with an email doesn't.
  - AC4 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - Decisions: leftover `ww:you:*` localStorage keys are left in place (harmless, never read). The bracket card's pick-only text is removed. Privacy never mentioned the pick. CONTEXT.md and the maintainer's guide are updated. ADRs 0005 and 0006 got a dated "Later notes" line.
