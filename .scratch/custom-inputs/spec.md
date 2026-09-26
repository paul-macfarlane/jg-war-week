---
title: War Weeker — shadcn everywhere (custom inputs)
status: done
phases: A done (PR https://github.com/paul-macfarlane/jg-war-week/pull/63); B done (PR https://github.com/paul-macfarlane/jg-war-week/pull/65); C done (PR feat/custom-inputs-phase-c)
labels: [done]
created: 2026-09-24
deadline: 2026-09-25T08:00-04:00 (staging freeze; whatever phases have merged by then ship)
source: Paul's first-use feedback and grilling session, 2026-09-24 (Q10–Q13, Q21–Q23)
order: 2 of 3 (after .scratch/admin-polish; blocked by nothing in it except shared shadcn components)
---

# shadcn everywhere

## Problem Statement

War Weeker's UI is hand-rolled. The admin forms use native `<select>`, `<input type="date">`, `<input type="time">`, checkboxes and color inputs. They look like default HTML next to the themed app, and they ignore the War Week's Appearance Theme.

The repo was set up for shadcn (`components.json`, style `base-nova` on `@base-ui/react`), but only `button.tsx` was ever added. Paul called this a major oversight: from now on War Weeker UI uses shadcn components.

## Solution

Move the whole UI to shadcn components, themed by the Appearance Theme's CSS variables. Do it in three phases, each mergeable alone, so the 8 AM freeze ships whatever is done:

- **Phase A: form controls.**
  - Select for every native select.
  - Combobox wherever a list is long or accepts typing.
  - A date picker (Calendar in a Popover).
  - A War Week date-range picker.
  - A time combobox.
  - Switch for boolean checkboxes.
  - Styled number inputs.
  - A color picker with theme swatches.
  - The "Which one is you?" picker.
- **Phase B: form structure and feedback.**
  - shadcn Field/Label/description/error layout on every form.
  - AlertDialog for every delete or destructive confirm.
  - Sonner toasts for save and fail messages.
- **Phase C: participant-page building blocks.**
  - Card, Tabs, Badge, Avatar.
  - Sheet for the More menu.
  - Skeleton loading states.

Then make it stick: a repo rule in CLAUDE.md and the maintainer's guide, and a lint check that fails on raw native controls.

## User Stories

### Phase A: form controls
1. As an Organizer, I want every dropdown in admin to be a themed Select with keyboard support and the War Week's colors: Day, category, Competition, target Team/Participant, Mode, font preset, Team, and Award recipients.
2. As an Organizer, I want long lists (Participants on Points Entry and Awards, Competitions) to be searchable comboboxes, so I can type "pau" instead of scrolling.
3. As an Organizer, I want the War Week start/end as one **range calendar**: tap start, then end. Existing Days show as dots, and Days that would fall outside the new range are marked before I save.
4. As an Organizer, I want each Day's date as a themed date picker.
5. As an Organizer, I want Schedule start/end times as a **time combobox**:
   - It lists 5-minute steps.
   - It accepts typing ("7:30p", "19:30", "730pm").
   - It shows 12-hour times, and end-time options show the duration ("8:30 PM · 1h").
6. As an Organizer, I want on/off options (Counts toward the Team, Also post to Slack, Leader, pinned) as Switches.
7. As an Organizer, I want color fields (Appearance Theme colors, Team color) as a color picker with a hex field and swatches from the current Appearance Theme and Team colors.
8. As an Organizer, I want number fields (points, max points) styled consistently, with a decimal keypad on phones.
9. As a Participant, I want "Which one is you?" on the Teams page to be a searchable combobox of the roster, themed like the rest of the War Week.

### Phase B: structure and feedback
10. As an Organizer, I want every form field laid out the same way (label, optional description, inline error), so errors are always in the same place.
11. As an Organizer, I want deletes and other destructive actions to ask in an AlertDialog that names what will be deleted and any counts the server returns. This replaces `confirm()` or inline confirm buttons.
12. As an Organizer, I want a toast when a save succeeds or fails (including "Slack post failed"), instead of ad-hoc inline status text.

### Phase C: participant pages
13. As a Participant, I want Standings, Competitions, Announcements, Awards and the Archive built from shadcn Card/Badge/Avatar, so the app looks consistent.
14. As a Participant, I want the More menu as a Sheet on phones.
15. As a Participant, I want skeletons instead of blank space while pages load.

### Keeping it that way
16. As a maintainer, I want CLAUDE.md and `docs/maintainers-guide.md` to say "UI uses shadcn components; add them with `pnpm dlx shadcn@latest add <name>`; don't hand-roll a control shadcn has", so future changes follow it.
17. As a maintainer, I want `pnpm lint` to fail on raw `<select>`, `<input type="date">`, `<input type="time">`, `<input type="color">` and `<input type="checkbox">` in `src/` outside `src/components/ui/`, so regressions are caught.

## Implementation Decisions

- **Library:** shadcn CLI with the existing `components.json` (base-nova / Base UI). Components land in `src/components/ui/`. Expected set:
  - `select`, `combobox` (or `popover` + `command`), `calendar` (react-day-picker), `popover`, `switch`, `input`, `textarea`, `label`, `field`
  - `alert-dialog`, `sonner`
  - `card`, `tabs`, `badge`, `avatar`, `sheet`, `skeleton`

  Add only what's used.
- **Theming:** components read the existing CSS variables that `src/lib/theme.ts` sets from the Appearance Theme. Map shadcn tokens (`--primary`, `--accent`, `--background`, `--foreground`, `--popover`, `--ring`, …) to those variables in `globals.css`, not per component. Popovers render inside the themed root, so each edition's colors apply. Verify on XI plus one dark past edition.
- **Wrappers owned by the app** (in `src/components/`, built from `ui/` pieces):
  - `DateRangePicker`, taking Days to show as dots.
  - `TimeCombobox`, a pure `parseTime(input): "HH:MM" | null` plus a 5-minute option list, unit-tested.
  - `ColorField`.
  - `EntityCombobox`, for Teams/Participants/Competitions.
- **Forms still submit the same values.** Every converted control posts the same names and string formats the server actions and zod schemas take today (`YYYY-MM-DD`, `HH:MM`, `#rrggbb`, ids). No server action or schema changes. Base UI Select/Combobox need a hidden input or the existing `useActionState` pattern (ticket 18's standard form handling) to post values; keep that one pattern.
- **Phones:** popovers are full-width at phone width and never cause horizontal overflow. Tap targets are at least 44px.
- **Phase C** changes presentation only. Standings, the hidden-Standings behavior and the Reveal keep their current logic and markup semantics, so smoke still passes. Hidden totals never reach the client (existing rule).
- **Lint rule:** an ESLint `no-restricted-syntax` rule on JSXOpeningElement for those native elements/types, off for `src/components/ui/**`.
- **Phase order and merging:** A, B and C are separate tickets and PRs into `staging`, in that order. Each must leave the app fully working. The rule and lint check land with Phase A (the lint check covers controls only, which A has cleared).

## Acceptance Criteria

- [ ] **A:**
  - No native select, date, time, color or checkbox inputs remain in `src/` outside `ui/`, and the lint rule enforces it (a test fixture or a documented one-off failing run).
  - Every admin form saves the same values as before; smoke's admin/seed checks still pass.
- [ ] **A:** `parseTime` unit tests cover "7:30p", "7:30 pm", "730pm", "19:30", "7" and invalid input. The range picker refuses a range that leaves a Day outside it, with the existing error text.
- [ ] **A:** "Which one is you?" searchable combobox works, and "Not me / clear" still works.
- [ ] **B:** every destructive action opens an AlertDialog. Refused deletes show the server's counts. Save/fail toasts appear, including the Slack-failure message.
- [ ] **C:** the listed participant surfaces use shadcn components. The More menu is a Sheet on phones. Skeletons show while loading.
- [ ] CLAUDE.md and `docs/maintainers-guide.md` state the shadcn rule.
- [ ] Screenshots of every converted admin form, plus Teams, Standings and More, at **375px and 1280px** in **XI and one dark past edition**, with a select/popover open where relevant, under `test-results/<test-name>/`, committed.
- [ ] Zero horizontal overflow at 375, 768, 812, 1024 and 1280px on every admin and participant page (the existing sweep).
- [ ] `pnpm gate` passes for each phase's PR.

## Out of Scope

- Any schema, server action or access change.
- Removing hidden Standings (spec 3).
- A dark/light mode toggle; the Appearance Theme remains the only theming.
