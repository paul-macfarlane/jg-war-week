# 78: The admin refusal page wears the current War Week

**What to build:** The "Organizers and Hosts only." page (`AdminRefused` in `src/components/admin-shell.tsx`) renders outside `ThemeRoot`, so it shows the app's neutral black and white instead of the current War Week's colors and font. Wrap it in the War Week's theme like every other admin page.

**Blocked by:** none

**Status:** ai-review

**Source:** regression checklist run, ticket 53 (free-for-all pass, `pnpm seed:demo:xii`, 2026-10-02)

## Need

- **Participant / Host:** a page they land on by mistake should still look like this War Week's app, not a different site.

## Finding

- **Checklist lines:** Admin, as a Host → "Organizer-only pages refuse."; User Pages → "Access." (both carry the implied page basics: the theme check).
- **Viewports:** 1440×900 and 390×844.
- **Roles:** Host (`e2e-host@jahnelgroup.com`) on `/admin/setup/war-week`, `/admin/setup/days`, `/admin/setup/teams`, `/admin/setup/faq`, `/admin/awards`, `/admin/organizers`, `/admin/setup/next`, and on `/admin/brackets/<a Competition they don't host>`; linked Participant and unlinked account on `/admin`.
- **Screenshots:** `test-results/r8-quick-fixes/checklist/admin-setup-next-host-ffa-1440/refused.png`, `.../admin-setup-next-host-ffa-390/refused.png`, `.../admin-ffa-1440/refused.png`, `.../admin-ffa-390/refused.png`, `.../admin-ffa-unlinked-390/refused.png`.
- **Expected:** the page has a `[data-theme-root]` carrying XII's `--light-*`, `--dark-*` and `--font-sans` (`warWeekThemeStyle`), and shows XII's magenta and blue.
- **Observed:** no `[data-theme-root]` on the page at all; the heading, link and button are neutral black on white.

## Acceptance criteria

- [ ] The refusal page passes the checklist's theme check for the current War Week at both viewports.

## Comments

- **2026-10-02, teams pass (`pnpm seed:demo`, XI live):** same defect. The refusal page has no `[data-theme-root]` at 1440 and 390 for the Host on every Organizer-only page and on `/admin/brackets/<a Competition they don't host>`, and for the linked Participant and the unlinked account on `/admin`; it shows neutral black and white instead of XI's green on black. Screenshots: `test-results/r8-quick-fixes/checklist/admin-setup-next-host-teams-1440/refused.png`, `.../admin-setup-next-host-teams-390/refused.png`, `.../admin-teams-390/refused.png`, `.../admin-teams-unlinked-390/refused.png`, `.../admin-brackets-host-teams-390/not-hosted.png`.
- **2026-10-02, triage (Paul):** Ready as written: wrap the refusal page in the War Week theme. Batched into epic R14 (`../epics/R14-quick-wins.md`).
- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r14`): claimed; `ready-for-agent` → `in-progress`. Execution record: `../epics/R14-execution.md`.
