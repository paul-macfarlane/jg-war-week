# 35: Selects and the color picker behave on a phone

**What to build:** Select triggers match the 44px inputs beside them and open their list below the field, and the color picker stops raising the phone keyboard when it opens.

**Blocked by:** none

**Status:** done

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer:** At 375px every `OptionSelect` trigger (Mode and Font on War Week settings, Team on the Roster, the admin edition switcher) is 32px tall next to 44px inputs. `OptionSelect` asks for `h-11 sm:h-9` (`src/components/option-select.tsx`), but `src/components/ui/select.tsx` sets `data-[size=default]:h-8`, which wins. The Award form's Team select (`src/components/award-form.tsx`) uses the same trigger.
- **Organizer:** Tapping Mode opens a small desktop-style list placed over the trigger (Base UI's `alignItemWithTrigger`, on by default in `ui/select.tsx`), covering the field above.
- **Organizer:** Tapping a color (`src/components/color-field.tsx`) opens a popover that focuses its hex text input, so the phone keyboard covers the swatches. Most people want a swatch.

## Decisions

- In `ui/select.tsx` (a "JG War Week edit" comment), the default trigger height matches `Input`: 44px below `sm`, 36px from `sm`. Then `OptionSelect`'s own height class can go.
- `alignItemWithTrigger` defaults to `false`, so the list opens below the trigger (or above when there's no room below), at least the trigger's width. Items stay at least 44px below `sm`.
- `ColorField`'s popover doesn't focus the hex input on a coarse pointer (`(pointer: coarse)`); it focuses the popup (Base UI Popover `initialFocus`). With a fine pointer it keeps today's focus. The date pickers' popovers have no text input and are unchanged.

## Acceptance criteria

- [ ] At 375px the Mode, Font, Team (Roster and Award) and edition switcher triggers are 44px tall, level with the inputs beside them; at 1280px they're 36px, like `Input` at `sm`+.
- [ ] Opening Mode at 375px shows the list below the trigger without covering the field above it.
- [ ] With a touch pointer (Playwright `hasTouch`, `isMobile`), tapping a Color field opens the popover and `document.activeElement` is not the hex input; with a mouse at 1280px, the hex input is focused as today.
- [ ] Playwright screenshots at 375px of the open Mode list and open color popover under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r5`), `ready-for-agent` → `in-progress`; branch `feat/regression-r5-admin-on-a-phone` from `staging` `50acefb`. Execution record: `../epics/R5-execution.md`.
- 2026-09-30 [AI CODE REVIEW]: T9 (levelness check could be skipped) resolved. Full tables: `../epics/R5-execution.md` [AI CODE REVIEW].
- 2026-09-30 [CLOSEOUT]: D35 `c6f89d5` (Sonnet); review fixes `f79549c`. Criteria 35-1 … 35-3 PASS; `pnpm format:check && pnpm gate` exit 0 at `4bee992` (`test-results/r5-gate/gate.txt`); screenshots `test-results/e2e/regression-r5-r5-35-*/`. PR https://github.com/paul-macfarlane/jg-war-week/pull/107. `in-progress` → `ai-review` → `done`. Details: `../epics/R5-execution.md` [CLOSEOUT].
