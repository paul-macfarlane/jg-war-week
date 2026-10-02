# 52: Remove "Which one is you?"

**What to build:** Delete the `YouPicker` on the Teams page, the `ww:you:<edition>` device pick and the `via: "pick"` branch of `resolveYou`: You is found by account linking only. Participant email stays optional; the roster admin shows a quiet hint on rows without an email ("No email: won't be linked when they sign in").

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, P7; grilling Q6

## Decisions

- Leftover `ww:you:*` keys in `localStorage` are harmless; clear them on load if trivial, else leave them.
- Update CONTEXT.md (**You**, **Account linking**, Access rules mentions of the pick), Privacy if it mentions the device pick, and the maintainer's guide.

## Acceptance criteria

- [ ] No "Which one is you?" in `src/`; `resolveYou` has no pick branch; its tests updated.
- [ ] A Participant linked by email is still highlighted (existing e2e passes).
- [ ] The roster shows the missing-email hint; screenshot at both viewports.
- [ ] `pnpm gate` passes.
