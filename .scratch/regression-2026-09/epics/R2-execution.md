# Execution record — Epic R2: Light and dark Appearance Themes

Contract: [`R2-light-and-dark-themes.md`](./R2-light-and-dark-themes.md)
and its tickets [`12`](../issues/12-light-and-dark-appearance-themes.md),
[`22`](../issues/22-disabled-enroll-button-looks-disabled.md) and
[`26`](../issues/26-about-games-still-crop.md), with
[`13`](../issues/13-admin-theming.md) checked at closeout; the decisions in
[`../grilling-2026-09-28.md`](../grilling-2026-09-28.md) (Q29–Q31, Q36).
Branch `feat/regression-r2-light-dark` from `staging` at `a74d4df` (R3
merged, PR #92; R4 merged, PR #93). `/atlas-implement` work package
`regression-r2`.

## Plan

Written by `/atlas-plan` on 2026-09-29 and red-teamed (a schema change;
`docs/agents/planning.md`), one revision cycle; the record is at the end.
The contract above is unchanged. This section resolves it into technical
decisions, ordered steps and a criterion-level verification map. Anything
here a ticket doesn't say is a planning decision, not a scope change.

### Intent

Every Appearance Theme renders in both color schemes: the Organizer's five
colors are the **base palette**, whose scheme is whatever its background
reads as (`backgroundColorScheme`); the **derived palette** for the other
scheme is computed from it (background and text swap; primary and accent
adjusted until they pass contrast) and any of its five colors may be
overridden in Setup. Viewers pick a **Display** — Light, Dark or System
(default) — in the header menu; it lives in `localStorage` on the device
across War Weeks and resolves to the page's color scheme with no flash on
load. Every themed surface (edition pages, the Finale, the Archive,
`/about`, `/admin`, sign-in, install, privacy, terms) follows the viewer's
choice. Alongside: a disabled Enroll / Withdraw / Join / Leave button reads
as disabled in both schemes (22), and the `/about` Games still shows the
Competition's name (26).

### Technical decisions

The choices the tickets leave open, each checked against the grilling
record. None changes the contract.

1. **Vocabulary.** "Mode" is taken (`teams` / `free-for-all`) and
   "Appearance" would collide with "Appearance Theme", so the viewer's
   choice is the **Display** (Light / Dark / System; the control's label
   and the `localStorage` key `ww:display`) and what it resolves to is the
   **color scheme** (`light` / `dark`, the CSS term the code already uses).
   The Organizer's five colors are the **base palette**; the computed set
   for the other scheme is the **derived palette**; an Organizer's
   per-color replacement in it is an **override**. CONTEXT.md gains these
   five terms and a "Light and dark Display rules" section (decision 16); "Appearance
   Theme" keeps its meaning (colors, logo, banner, font — now both
   palettes). In code: `Palette`, `derivePalette`, `Display`,
   `DisplayMenu`.
2. **Derivation (Q29), one pure function in `src/lib/theme.ts`.**
   `derivePalette(base: Palette, overrides: Partial<Palette> = {})`,
   staged so an override is always honoured against the final colors:
   (a) `background = overrides.background ?? base.foreground`,
   `foreground = overrides.foreground ?? base.background`;
   (b) `primary = overrides.primary ?? readableText(base.primary,
   background, foreground)` (hue kept; lightness and chroma moved toward
   the new text color only as far as WCAG AA needs);
   (c) `primaryForeground = overrides.primaryForeground ??
   readableOn(primary, base.primaryForeground)`;
   (d) `accent = overrides.accent ?? readableText(base.accent,
   background, foreground)` (the accent is a border and a surface under
   `accent-foreground`; lifting it to 4.5:1 against the background as if
   it were text is stricter than the 3:1 UI minimum and keeps one rule).
   So an override replaces exactly its color and the colors derived
   *from* it re-derive against it. Candidate evidence (below) shows this
   rule, with no overrides, reaches 4.5:1 on every text-on-surface pair for
   all eleven seeds in the derived scheme. Overrides belong to the other
   scheme: when a settings save moves the base background across the
   light/dark boundary (`backgroundColorScheme` changes, checked against
   the row's `background_color` selected inside the existing transaction,
   `src/mutations/setup.ts:110`), the mutation nulls the untouched
   overrides in the same update (decision 7), the form shows the notice
   "Changing the background to a light one clears the dark mode colors
   (they'll be derived again)" as soon as the live preview detects the
   flip, and the save's toast repeats it. A refusal would be heavier than
   the case deserves.
3. **Both palettes travel on the themed root; CSS picks one.**
   `warWeekThemeStyle` emits every token it emits today twice, prefixed
   `--light-*` and `--dark-*` (the base palette under its own scheme's
   prefix, the derived palette under the other), plus `--font-sans`; it no
   longer sets `colorScheme`. `ThemeRoot` renders `data-theme-root` when
   it is given a `style` (a root without one sets nothing and inherits
   `:root`). `globals.css`, in this order and with these selectors:

   ```css
   /* unthemed chrome: /history's page, not-found, admin error */
   :root { color-scheme: light; --background: …light defaults… }
   html[data-display="dark"] { color-scheme: dark; --background: …dark defaults… }
   @media (prefers-color-scheme: dark) {
     html:not([data-display="light"]) { color-scheme: dark; …dark defaults… }
   }
   /* themed roots: map the shadcn tokens to one of the two inline sets */
   [data-theme-root] { color-scheme: light; --background: var(--light-background); … }
   :where(html[data-display="dark"]) [data-theme-root]:not([data-scheme]) { color-scheme: dark; --background: var(--dark-background); … }
   @media (prefers-color-scheme: dark) {
     :where(html:not([data-display="light"])) [data-theme-root]:not([data-scheme]) { …the dark set… }
   }
   [data-theme-root][data-scheme="dark"] { …the dark set… }
   /* data-scheme="light" needs no rule: the :not([data-scheme]) rules skip it */
   ```

   The `:root` rules keep their natural specificity (`html[…]` (0,1,1)
   beats `:root` (0,1,0)); the themed-root rules use `:where()` on the
   `html` part so a root pinned with `data-scheme` (`ThemeRoot scheme`
   prop, used by the two Setup previews only) wins on the `:not()`, not on
   order. System is pure CSS (no listener); an explicit choice is one
   attribute. `pageColorScheme`, `data-color-scheme` and the
   `html:has(...)` rule go: the viewport's `color-scheme` follows the
   viewer, on every page. The one hard-coded palette that must follow the
   scheme gets a token: `--warning` (in `:root`, `amber-700` under light
   and `amber-400` under dark; on themed roots `warWeekThemeStyle` emits
   `--light-warning` / `--dark-warning` per palette as
   `readableText(amber, background, foreground)`, because amber-700 is
   4.27:1 on viii's base and 4.49:1 on ix's derived background; exposed in
   the `@theme inline` block as `--color-warning: var(--warning)`; the
   pair joins 12-1), used by the Setup contrast warnings (today
   `text-amber-700 dark:text-amber-400`), the Points Entry and Announcement
   form warnings (`text-amber-600`). The `dark:` Tailwind variant itself
   stays as it is (keyed on a `.dark` class no page sets): with the tokens
   and `--warning` themed per scheme, switching shadcn's second styling
   path on would change every page's look without a ticket asking for it.
   Schedule category colors (`amber-500` etc.), Team colors and the
   destructive red stay unthemed by design (CONTEXT.md).
4. **No flash (ticket 12 Scope).** `src/app/layout.tsx` puts one inline
   `<script dangerouslySetInnerHTML>` inside `<head>`, before any content,
   that reads `localStorage["ww:display"]` in a try/catch and sets
   `document.documentElement.dataset.display` when it is `light` or
   `dark`; `<html suppressHydrationWarning>`. (The `next-themes` approach;
   if React 19 logs a warning for it, `next/script` with
   `strategy="beforeInteractive"` and the same inline body is the
   fallback — both render before the body.) The value set is `light |
   dark | system`; anything else, an absent key or a throwing
   `localStorage` is System.
5. **The Display control.** One client component,
   `src/components/display-menu.tsx`: a single-select, non-deselectable
   `ToggleGroup` (the guide's rule for a choice among a few options) of
   Light / Dark / System with `lucide` Sun / Moon / Monitor icons,
   `aria-label="Display"`, each item `aria-label`ed (the icon-only variant
   has no visible text), 44px tall on phones. It reads the stored value
   with `useSyncExternalStore` (server snapshot `system`; a same-tab
   `ww:display-change` window event plus `storage` for other tabs, the
   `PICK_EVENT` pattern in `you.tsx`), writes `localStorage` (try/catch)
   and sets or removes `html[data-display]`. It renders in the header menu
   everywhere a header exists: the phone More Sheet (`MoreMenu`) and
   `/[edition]/more`, the desktop `TopNav` (icon-only, beside the account),
   and the `AdminShell` header. `/history`, `/about`, sign-in, install,
   privacy and terms have no header menu and follow the stored choice
   (ticket 12 Scope names the header menu; a second control is out).
6. **Schema: five nullable override columns on `war_week`.**
   `override_primary_color`, `override_primary_foreground_color`,
   `override_accent_color`, `override_background_color`,
   `override_foreground_color`, `varchar(32)`, null = derived. Flat columns
   like the base five (the repository's style), no backfill, one generated
   migration (`pnpm db:generate` → `drizzle/0017_*.sql`).
   `warWeekSettingsSeedShape` gains `overridePrimary`,
   `overridePrimaryForeground`, `overrideAccent`, `overrideBackground`,
   `overrideForeground` (`hexColor.nullish()`), so the seed files, the
   loader (`upsertWarWeek`), the settings form/action/mutation
   (`settingsSchema` uses `optional(seed.overrideX)`, the nullish shape)
   and Create next War Week (`copySettings` copies the overrides;
   `DEFAULT_SETTINGS` has them null) share one rule. `ThemeColors` gains
   the five `override*` fields as *optional* (`ABOUT_FALLBACK_THEME` stays
   valid; `src/lib/about.test.ts`'s exact `toEqual` of `STATIC_PAGE_THEME`
   gains the override, in D1b). `seeds/xi.json`
   sets one override, `overridePrimary` for XI's light scheme (a Matrix
   green that passes 12-1 on `#d1ffd6`; `#0a7a1f` does at 4.97:1 with white
   text at 5.5:1, the derived value `#00801c` is the reference), so the
   seed → loader → row → page path is real, and `STATIC_PAGE_THEME` gets
   the same override (its comment already ties it to `seeds/xi.json`). The
   other seeds add none (the derivation passes them all). Because XI is the
   edition smoke and e2e edit, no test may assume XI's overrides are null:
   an untouched save leaves every `override_*` equal to its value before
   the save (primary `#0a7a1f`, the other four null); every `finally`
   restores the value it read first, never null; and smoke's settings
   input (built from the SELECT in `scripts/smoke/setup.ts:77-101` and its
   twin in `lifecycle.ts`) reads all five `override_*` columns, so an
   existing `updateWarWeekSettings` call never clears them by sending
   `undefined`.
7. **Setup form.** The Appearance Theme fieldset keeps its five
   `ColorField`s and gains a second group titled by the *other* scheme
   ("Dark mode colors" when the base background reads light, "Light mode
   colors" otherwise; the title flips live as the background changes, with
   decision 2's notice). Each of its five fields is a `ColorField`
   *without a `name`* showing the derived hex while there is no override,
   paired with a hidden `FormValueInput name="overrideX"` whose value is
   the override or `""` — so saving the form without touching the group
   keeps every override as it was (the form posts `FormData`, and a named
   `ColorField` would post the derived hex as an override). `ColorField`'s
   hex input commits on blur even when nothing changed
   (`color-field.tsx:96`), so opening and dismissing the picker would
   freeze the derived color as an override: the override handler treats a
   value equal to the current derived color as no override, and
   `ColorField` fires `onValueChange` only when the value changed. When
   the live preview detects a scheme flip, the form clears its override
   state (posting `""`) at that moment, so overrides the Organizer sets
   *after* the flip, in the same save, survive; the mutation, on a flip,
   nulls only overrides equal to the stored row's values (the untouched
   ones). Both cases tested in `src/mutations/setup.test.ts`. A
   `Reset to derived` ghost button (xs) shows only while overridden. Two
   previews, one per scheme, each a `ThemeRoot` pinned with `scheme`.
   `themeContrastWarnings` runs on both palettes and prefixes the other
   scheme's warnings with its name ("Dark mode: Text on background is …").
8. **Ticket 22: the Button's disabled look, per variant.**
   `disabled:opacity-50` leaves `buttonVariants`' base string; the
   `default` variant gets `disabled:bg-muted disabled:text-foreground
   disabled:border-border` (`--foreground` on `--muted` is ≥ 10.52:1 on
   every seed in both schemes — `--muted-foreground` on `--muted` was the
   first idea and fails War Week VIII's own palette at 4.12:1). Colour
   alone could read like an enabled `secondary` or `outline` button, so
   both variants also get a non-colour cue: `disabled:border-dashed
   disabled:cursor-not-allowed disabled:shadow-none`, and 22-1's
   screenshots are judged beside an enabled outline button.
   `outline` gets `disabled:text-muted-foreground` plus the same cue (its
   surface is the background, where muted text is ≥ 5.36:1, viii's own
   palette); `secondary`, `ghost`,
   `destructive` and `link` keep `disabled:opacity-50` on their own line.
   Enroll and Join are `default`; Withdraw and Leave are `outline`. The
   new pair, `--foreground` on `--muted`, joins the contrast test for every
   seed in both schemes. Accepted consequence, recorded here: every
   pending submit button in the app takes the same flat look while
   disabled. No `EnrollButton` change.
9. **Ticket 26: a 16:9 still framed from the Competition's name.** The
   `/about` card renders every still `aspect-video object-cover
   object-top`, so a taller capture would be cropped straight back.
   `captureGamesDemo` in `scripts/about-media.ts` stops scrolling to
   "Leaderboard"; after the Game saves it calls `scrollTo(0, 0)` (the
   `TopNav` is `sticky top-0`, `primary-nav.tsx:164`, so scrolling the
   `h1` to the frame's top hides it under the header — likely how the
   title was cut) and captures a 16:9 frame that holds more page: a
   1600 × 900 CSS viewport at `deviceScaleFactor` 1.6 (2560 × 1440 output,
   the same as today's 1280 × 720 at 2×). The script asserts, before
   shooting, that `h1.getBoundingClientRect().top ≥
   document.querySelector("header").getBoundingClientRect().bottom` and
   the first Game row's bottom ≤ the viewport height. If that fails at
   900, it retries once at 1920 × 1080, scale 1.3333 (still 2560 × 1440),
   and fails loudly if that fails too. Proof is the rendered card
   (`e2e/about-games.spec.ts`'s screenshot), not the PNG alone.
10. **`scripts/about-media.ts` pins the Display.** Its Chrome has no
    stored choice, so under System its stills would follow the Mac's
    scheme. It adds `Page.addScriptToEvaluateOnNewDocument` that stores
    `ww:display` = the scheme of `STATIC_PAGE_THEME`'s background
    (`backgroundColorScheme`, dark for XI) — not `setEmulatedMedia`, whose
    reduced-motion call replaces any earlier feature list — so every still and the Finale
    poster wear XI's base palette, the one its Organizer designed. The
    `/about` evidence screenshots (`test-results/28-splash/`) add one light
    capture of `/about` at desktop so the showcase's other scheme is on
    record. `--stills` reruns everything but the Finale poster, as today.
11. **Ticket 13 is moot; Paul confirmed at plan approval (2026-09-29).** `/admin` wears
    the edited War Week's Appearance Theme (`AdminShell`) and, after this
    epic, in the viewer's own scheme like every other page, so editing next
    year's edition in last year's dark theme on a light desk no longer
    happens; it already opens on the current War Week for an Organizer
    (CONTEXT.md). Ticket 13 is `needs-info`, so this is a human decision
    (E-1 is a human gate): on Paul's yes, closeout sets `Status: wontfix`
    (the tracker's "will not be actioned" label) with this reason; on a
    no, 13 stays open for its own ticket and the epic criterion records
    the rescope.
12. **Proof against real dependencies.** Unit: `src/lib/theme.test.ts`
    (derivation per seed, both schemes, all pairs; an override replaces
    its color and the dependent colors re-derive; `warWeekThemeStyle`
    shape), `src/seed/archive-contrast.test.ts` extended to both schemes,
    `src/mutations/setup.test.ts` (override save; a scheme flip clears the
    untouched overrides and keeps ones set after the flip),
    `src/mutations/war-week-lifecycle.test.ts` (`copySettings`
    copies non-null overrides). Smoke: `scripts/smoke/archive.ts` (two
    checks) and `scripts/smoke/setup.ts` (one) today assert
    `--primary:<hex>` in page bodies and would fail; they are rewritten to
    `--<scheme>-primary:<hex>` with the scheme from the row's
    `background_color`; `setup.ts` asserts XI's seeded override right after
    the seed load (before anything edits XI), then adds an override
    round-trip through the action (row and page carry it; `finally`
    restores the value read first); `scripts/smoke/
    pages.ts` asserts the built `/xi` HTML has the inline script inside
    `<head>` before `<body>`. e2e (`e2e/theme.spec.ts` rewritten,
    `e2e/axe.spec.ts` new with `@axe-core/playwright` 4.13.0 as a
    devDependency, on the registry): every "follows the choice" assertion
    compares the *computed `background-color` of the themed root*
    (`[data-theme-root]`; on `/history` the `body` and one Archive card)
    with the expected palette's background for that scheme (themed roots,
    whose tokens come from hex, compute as `rgb(...)`; `/history`'s `body`
    takes the `:root` `oklch()` tokens and Chrome returns `oklch(1 0 0)` /
    `oklch(0.145 0 0)`, so those are compared as strings), resolved with
    the same `derivePalette` the unit tests use, imported from
    `src/lib/theme` (the config already imports `src/`); `<html>`
    `color-scheme` alone proves nothing, since it flips on every page.
    The no-flash check, with Dark stored (`context.addInitScript` seeds
    `localStorage` before the first `goto`), aborts only script requests
    under `_next/static` (`page.route("**/_next/static/**", r =>
    r.request().resourceType() === "script" ? r.abort() : r.continue())`;
    the CSS in `_next/static/chunks/*.css` must still load), so only the
    inline script can have set `html[data-display]` and the root's dark
    background. The Organizer path through the real form: read the five
    `override_*` first; save settings untouched → each unchanged
    (`runQuery`; primary `#0a7a1f`, the rest null); open and dismiss the
    other scheme's Primary picker, save → still unchanged; set one via the
    form → row and `/xi` root style carry it; Reset → back to derived;
    `finally` restores the values read first. axe: `withTags(["wcag2a",
    "wcag2aa"])` on `/xi` (as a Participant), `/history` and `/about` in
    both schemes, zero `color-contrast` violations asserted; every
    `violations` and `incomplete` list saved and the `incomplete` entries
    (text over `/about`'s gradient) reviewed in the closeout; a baseline
    run of the same spec against `staging` first (step 0, using
    `emulateMedia` only, since the control doesn't exist yet; `/xi` still
    renders dark there from its theme) so this epic knows which findings
    it inherits, written to `test-results/r2-axe-baseline/` (outside
    `test-results/e2e/`, which Playwright wipes) and committed. Ticket 22 adds a computed-style
    assertion (disabled Enroll's background equals the resolved `--muted`
    and differs from `--primary`) beside its screenshots.
13. **What does not change.** `/api/mcp` exposes no theme colors (nothing
    to add; ticket 21's rules untouched). The installed app's chrome
    (`APP_THEME_COLOR`, the manifest) stays `#171717` for both schemes.
    `themeSwatches` offers the base palette only. The raw
    `warWeek.primaryColor` passed as a fill to the Avatar, `EntrantMark`,
    the Finale's `PlaceMark` and `games-view.tsx` stays the base palette's
    primary in both schemes (a colored mark, not text; its own text uses
    `readableOn`); CONTEXT.md's Avatar rule says "the base palette's
    primary color". A primary override never reaches those marks: recorded
    as an exclusion, revisit if it looks wrong on a real theme.
14. **Sequential, direct checkout, four deliverables.** `pnpm e2e` binds
    port 3200 and resets every seed, so no two workers run it at once, and
    every deliverable here needs it. D1 (derivation, schema, Setup) →
    D2 (viewer Display, CSS, smoke and e2e proofs) → D3 (Button, ticket 22)
    → D4 (about-media, ticket 26, docs, ticket 13 closure) — D4 last so the
    stills show the final colors. Models: D1 and D2 Opus (design-bearing:
    CSS token mapping, no-flash, contrast rule); D3 and D4 Sonnet
    (mechanical, each with a precise packet).
15. **Environment.** This checkout has no `.env.local`; DB, smoke and e2e
    commands export the `.env.example` values first
    (`set -a; . ./.env.example; set +a`). Postgres is the existing
    `war-weeker-postgres` container on `localhost:2345`.
    `scripts/about-media.ts` needs Google Chrome at its default path (it
    ran for R3 on this Mac) and a fresh `pnpm build` + `pnpm seed:load
    --reset seeds/*.json`. `pnpm e2e <spec>` (no `--`); Playwright clears
    `test-results/e2e/` on every run, so other specs' committed
    screenshots are restored with `git checkout` before committing.
16. **Docs.** CONTEXT.md: glossary rows for Display (with a line that it
    is not a Participant's display name), color scheme, base palette,
    derived palette, override; a "Light and dark Display rules" section
    (beside the existing "Schedule display rules" and "Competition and
    roster display rules"; System
    default, `ww:display`, the derivation rule and the scheme-flip
    clearing, every themed page follows the viewer, the installed app's
    chrome doesn't, the Avatar fill is the base primary).
    `docs/maintainers-guide.md`: the "Run a new War Week or change this
    year's theme" recipe says Setup shows both schemes, the other is
    derived, any color can be overridden and a background change across
    light/dark clears them; where the viewer switch is; the form-control
    notes mention `ThemeRoot scheme` and `--warning`.
    `docs/agents/testing.md` (team-owned): its e2e coverage sentence "an
    edition's Appearance Theme darkens the whole page while the Archive
    stays light" becomes "the viewer's Display (Light / Dark / System)
    changes every themed page, survives reload and follows the OS; axe
    contrast on three pages in both schemes". `/about`: the hero or
    Organizer-setup card copy says every edition works in light and dark
    and viewers choose (`src/lib/about.ts` / `src/app/about/page.tsx`),
    and the stills are regenerated (decision 10). The showcase rule is
    12-5 and E-1.

### Schema

```
war_week
  + override_primary_color             varchar(32) null
  + override_primary_foreground_color  varchar(32) null
  + override_accent_color              varchar(32) null
  + override_background_color          varchar(32) null
  + override_foreground_color          varchar(32) null
```

One migration, additive, no backfill. Migration drift check in CI. The
seed loader writes them from the seed's `override*` fields (null when
absent), so a reload of an unchanged seed is idempotent (smoke loads every
seed twice); `seeds/xi.json` carries one (decision 6).

### Repository areas, interfaces, domain concepts

| Area | Files | Change |
|---|---|---|
| Theme rules | `src/lib/theme.ts`, `src/lib/theme.test.ts`, `src/lib/color.ts` (reuse only) | `Palette`, `derivePalette(base, overrides)`, `warWeekThemeStyle` emitting `--light-*`/`--dark-*`, `themeContrastWarnings` over both palettes, `ThemeColors` with optional `override*` |
| Schema, migration, seed | `src/db/schema.ts`, `drizzle/0017_*.sql` + `meta/`, `src/lib/setup.ts` (`warWeekSettingsSeedShape`, `WarWeekSettingsInput/Values`, `settingsInputFrom`, `settingsSchema`), `src/seed/load.ts`, `src/seed/schema.test.ts`, `src/seed/archive-contrast.test.ts`, `seeds/xi.json`, `src/lib/about.ts` (`STATIC_PAGE_THEME` override) | override columns and fields; XI's one override |
| Setup | `src/components/war-week-settings-form.tsx`, `src/actions/setup.ts` (key-by-key read), `src/mutations/setup.ts` (+ test: scheme flip clears overrides), `src/lib/war-week-lifecycle.ts` (`DEFAULT_SETTINGS`), `src/mutations/war-week-lifecycle.ts` (`copySettings`, + test) | other-scheme group with hidden inputs, two previews, warnings, notice |
| Themed roots and CSS | `src/components/theme-root.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/[edition]/layout.tsx` (drop `pageColorScheme`), `src/components/{war-week-settings-form,points-entry-form,announcement-form}.tsx` (`--warning`) | decision 3 and 4 |
| Display control | `src/components/display-menu.tsx` (new), `src/components/more-menu.tsx`, `src/app/[edition]/more/page.tsx`, `src/components/primary-nav.tsx`, `src/components/admin-shell.tsx` | the ToggleGroup in every header menu |
| Button | `src/components/ui/button.tsx` | disabled look per variant (22) |
| Smoke | `scripts/smoke/archive.ts` (2 checks rewritten), `scripts/smoke/setup.ts` (1 rewritten; settings input gains the override fields; override round-trip; XI's seeded override), `scripts/smoke/lifecycle.ts` (settings input gains the fields), `scripts/smoke/pages.ts` (`<head>` script) | `callAction` is untyped, so these are explicit edits, not compiler-found |
| e2e | `e2e/theme.spec.ts` (rewrite), `e2e/axe.spec.ts` (new), `e2e/enrollment.spec.ts` (dark capture + computed style), `package.json` / `pnpm-lock.yaml` (`@axe-core/playwright`) | 12's Playwright and axe criteria, 22's evidence |
| Showcase | `scripts/about-media.ts`, `public/about/*.png`, `test-results/28-splash/`, `src/lib/about.ts`, `src/app/about/page.tsx` | 26, decision 10, copy |
| Docs | `CONTEXT.md`, `docs/maintainers-guide.md`, `docs/agents/testing.md` | decision 16 |
| Tracker | `.scratch/regression-2026-09/issues/12,13,22,26-*.md`, `epics/R2-*.md` | claims, closeouts |

Domain concepts: Display, color scheme, base palette, derived palette,
override (decision 1). No ADR: no layering, access or data-flow rule
changes (ADR 0001–0006 untouched).

### Ordered implementation steps

0. **Branch, dependency, baseline.** `feat/regression-r2-light-dark`
   from `staging` `a74d4df`. `pnpm add -D @axe-core/playwright@4.13.0`.
   Write `e2e/axe.spec.ts` first and run it against the unchanged app
   (`pnpm build && pnpm e2e e2e/axe.spec.ts`, System = light only at this
   point, `emulateMedia` for dark) to record the inherited `violations` /
   `incomplete` under `test-results/r2-axe-baseline/`, committed.
1. **D1a — derivation.** `Palette`, `derivePalette`, `warWeekThemeStyle`
   (both token sets), `themeContrastWarnings` (both palettes);
   `theme.test.ts` updated for the new shape, plus per-seed / both-scheme
   / all-pairs (including `--foreground` on `--muted`) and override tests;
   `archive-contrast.test.ts` iterates both schemes.
2. **D1b — schema and seed.** Columns, `pnpm db:generate`, `pnpm
   db:migrate`; `warWeekSettingsSeedShape`, loader, `DEFAULT_SETTINGS`,
   `copySettings` (+ test), `settingsInputFrom`, `settingsSchema`, the
   action's key-by-key read, the mutation's scheme-flip clearing (+ test);
   `seeds/xi.json` and `STATIC_PAGE_THEME` override, `about.test.ts`
   updated; smoke settings inputs (`setup.ts`, `lifecycle.ts`) read all
   five `override_*` columns from the row; `seed/schema.test.ts` accepts
   and rejects an override.
3. **D1c — Setup form.** Decision 7. `ThemeRoot scheme` prop lands here
   (D2 wires the CSS; until then a pinned root just carries the
   attribute). Checkpoint: typecheck, lint, `pnpm test`.
4. **D2a — CSS and roots.** Decision 3 in `globals.css` and `ThemeRoot`;
   `[edition]/layout.tsx` drops `pageColorScheme`; `--warning` in the
   three forms; decision 4's script in the root layout.
5. **D2b — the control.** `display-menu.tsx` in the four header places.
6. **D2c — proof.** `e2e/theme.spec.ts` rewrite (12-2, 12-7, 12-8,
   12-9's form path), smoke rewrites and additions (`archive.ts`,
   `setup.ts`, `pages.ts`), `e2e/axe.spec.ts` both schemes. Checkpoint:
   `pnpm build`, `pnpm smoke`, `pnpm e2e e2e/theme.spec.ts e2e/axe.spec.ts
   e2e/archive.spec.ts e2e/finale.spec.ts e2e/forms.spec.ts`.
7. **D3 — Button (22).** Decision 8; `pnpm e2e e2e/enrollment.spec.ts`
   with the dark capture and computed-style assertion added.
8. **D4 — showcase and docs (26, 13, E-1).** Decisions 9, 10, 11, 16:
   `about-media.ts` changes, `pnpm build && pnpm seed:load --reset
   seeds/*.json && pnpm tsx scripts/about-media.ts --stills` (the Finale
   poster is left alone: under the pinned dark scheme its colors are XI's
   base palette, unchanged), `pnpm e2e e2e/about-games.spec.ts`, copy,
   the guide, CONTEXT.md, `testing.md`'s sentence, ticket 13 per Paul's
   answer.
9. **Gate.** `pnpm format:check && pnpm gate` → `test-results/r2-gate/
   gate.txt`. Closeout records, tickets `done`, PR into `staging`.

### Declared scope

In scope: ticket 12's Scope, tickets 22 and 26, ticket 13's closure, and
the areas above. Explicit exclusions:

- Saving the Display on the account (Q36: device only); a cookie or
  server-side knowledge of the choice.
- A per-War-Week or Organizer-set default Display; an Organizer disabling
  one scheme.
- Overrides for the base palette's own scheme (the base *is* that scheme).
- AI-generated themes (ticket 14, after this epic).
- Turning on Tailwind's `dark:` variant (decision 3).
- Theme colors in `/api/mcp`; the installed app's chrome colors; the
  Avatar / `EntrantMark` / `PlaceMark` / Games fills following an override
  (decision 13).
- A second Display control on `/history`, `/about`, sign-in, install,
  privacy or terms (decision 5).
- Overrides in any seed but `seeds/xi.json` (decision 6).
- Fixing axe findings that exist on `staging` and aren't
  `color-contrast` (step 0's baseline; reported, not owned).
- Video for `/about` (stills only, as today).

### Acceptance criteria and DoD coverage

Every ticket and epic criterion maps to a row in the verification map
(ids `12-n`, `22-n`, `26-n`, `E-n`). The team's showcase rule is `12-5` and
`E-1`.

### Verification map

Run surface: local + deployed (CI on the PR). Evidence policy per
`docs/agents/testing.md`: `PASS` artifacts are committed under
`test-results/`; the proof root is **not** cleared (Paul's R1 decision to
keep earlier epics' committed evidence, kept by R3 and R4); this epic's
evidence lives in `test-results/e2e/theme-*/`, `test-results/e2e/axe-*/`,
`test-results/e2e/enrollment-*/`, `test-results/e2e/regression-r3-about/`,
`test-results/28-splash/` and `test-results/r2-gate/gate.txt`. Fixtures:
the seeded War Weeks (reset by e2e's global setup and by smoke); smoke's
override check and the e2e form path each read XI's five `override_*`
first and restore those values in `finally` (never null: XI seeds one); `about-media.ts`
restores its Organizer, session and Game as today. Human gate: E-1 only.

| Id | Criterion | Command / action | Real dependency | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|---|
| 12-1 | Unit: the derivation for every seed passes contrast in both schemes; an Organizer override wins | `pnpm test src/lib/theme.test.ts src/seed/archive-contrast.test.ts` | none (pure) | for all 11 seeds × 2 schemes, every pair (`foreground` / `muted-foreground` / `primary-text` on `background` and `card`, `primary-foreground` on `primary`, `accent-foreground` on `accent`, `foreground` on `muted`, the card footer) ≥ 4.5:1; an override replaces exactly its color, the colors derived from it re-derive against it, the base is untouched; XI's seeded override reaches the light set | vitest output in `gate.txt` | step 1 | `theme.ts`, `color.ts`, any seed palette |
| 12-2 | Playwright: Light / Dark / System change the page and survive reload; System follows emulated `prefers-color-scheme`; screenshots of `/xi` in both | `pnpm e2e e2e/theme.spec.ts` | Chromium, local Postgres, build | as a Participant on `/xi`: choose Dark in the header control → `[data-theme-root]` computed `background-color` = XI's base background (`#000000`) and `<html>` `color-scheme` `dark`; reload → same; Light → the derived background (`derivePalette(xi).background`, `#d1ffd6`); System + `emulateMedia({colorScheme:"dark"})` → base, `"light"` → derived; `localStorage["ww:display"]` holds the choice; the same on `/x` (light base) in reverse | `test-results/e2e/theme-*/xi-light.png`, `xi-dark.png`; `gate.txt` | step 6 | `theme-root.tsx`, `globals.css`, `layout.tsx`, `display-menu.tsx`, the nav files, the spec |
| 12-3 | axe: no contrast violations on `/xi`, `/history`, `/about` in both schemes | `pnpm e2e e2e/axe.spec.ts` | Chromium, local Postgres, build, `@axe-core/playwright` | six analyses (`withTags(["wcag2a","wcag2aa"])`, `/xi` as a Participant), each with zero `color-contrast` violations; every `violations` and `incomplete` list saved; `incomplete` reviewed against step 0's baseline in the closeout | `test-results/e2e/axe-contrast/<page>-<scheme>.json`, `test-results/r2-axe-baseline/`; `gate.txt` | step 6 (baseline at step 0) | any color token, any of the three pages, `button.tsx` |
| 12-4 | Schema change and demo seed updated together; plan red-teamed | `pnpm db:migrate` from `0016`, `pnpm db:generate` (drift: nothing added), `pnpm smoke` (every seed twice; XI's `override_primary_color` equals the seed's and GET `/xi` carries `--light-primary:<it>`); this plan's red-team record | local Postgres | migration applies; drift clean; seeds load twice; the override lands; the record below | `gate.txt`; CI drift step; this file | step 2 | schema, migrations, seeds, loader |
| 12-5 | `/about` and `docs/maintainers-guide.md` updated | diff read; `pnpm e2e e2e/about-games.spec.ts`; `test-results/28-splash/` regenerated | Chrome (about-media) | copy names light and dark and the viewer's choice; the guide's theme recipe covers both schemes, overrides and the clearing rule; stills regenerated | the diff; `test-results/28-splash/*.png` and log | step 8 | `about.ts`, `about/page.tsx`, the guide, any still |
| 12-6 | `pnpm gate` passes | `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate` | local Postgres, Chromium | exit 0 | `test-results/r2-gate/gate.txt` | step 9 | any change |
| 12-7 | No flash of the wrong scheme on load (Scope) | `e2e/theme.spec.ts`: Dark stored via `context.addInitScript`; `page.route("**/_next/static/**", r => r.request().resourceType() === "script" ? r.abort() : r.continue())` (CSS still loads); `page.goto("/xi")`; assert `document.documentElement.dataset.display === "dark"` and the root's computed background = `#000000` with no client JavaScript loaded; smoke `scripts/smoke/pages.ts`: the built `/xi` HTML has the inline script inside `<head>` before `<body>` | Chromium, build | both hold | `gate.txt` | step 6 | `layout.tsx`, `globals.css` |
| 12-8 | Every themed surface follows the choice: the Finale, the Archive, `/about`, `/admin`, sign-in | `e2e/theme.spec.ts`: under Dark then Light, `/xi/finale` (root), `/history` (the `body` against the `:root` defaults, and War Week X's Archive card against X's base or derived background), `/about` (root, XI's palette), `/sign-in` anonymous (root, XI's palette), `/admin/setup` as the Organizer (root) each report the computed `background-color` of the expected palette for that scheme | Chromium, local Postgres | five surfaces × two schemes match | `test-results/e2e/theme-*/history-dark.png`; `gate.txt` | step 6 | the roots, CSS, `archive.tsx`, `admin-shell.tsx` |
| 12-9 | Setup: the other scheme's colors, derived by default, overridable, previewed with warnings; the save round-trips; an untouched save stores no override | `e2e/theme.spec.ts` as the Organizer on `/admin/setup`: read the five `override_*`; Save settings untouched → `runQuery` each unchanged (primary `#0a7a1f`, four null); open and dismiss the Primary picker, save → unchanged; set the other scheme's Primary via the form → row has it, `/xi` root style carries it under the other prefix; Reset to derived → null; `finally` restores what was read; smoke `scripts/smoke/setup.ts`: the action with an override → row and page, `finally` restores the value read first; `pnpm test src/mutations/setup.test.ts` (save; a flip nulls untouched overrides and keeps ones set after it) | local Postgres, build, Chromium | all pass | `gate.txt`; `test-results/e2e/theme-*/setup-overrides.png` | step 6 | the form, action, mutation, loader |
| 22-1 | A disabled Enroll / Withdraw / Join / Leave reads as disabled in both schemes and its text passes contrast | 12-1's `--foreground` on `--muted` pair (both schemes, every seed); `pnpm e2e e2e/enrollment.spec.ts`: the closed-enrollment card's disabled Enroll has computed `background-color` = the resolved `--muted` and ≠ `--primary`, in Light and Dark; captures in both | Chromium, local Postgres | pair ≥ 4.5:1 (≥ 10.52 measured); assertions pass; the screenshots, judged beside an enabled outline button, show a flat, dashed-bordered button under its reason | `test-results/e2e/enrollment-closed-refused/375.png`, `375-dark.png`; `gate.txt` | step 7 | `button.tsx`, `enroll-button.tsx`, theme tokens |
| 22-2 | Screenshot evidence under `test-results/e2e/<test>/` | as 22-1 | | | as 22-1 | step 7 | |
| 22-3 | `pnpm gate` passes | as 12-6 | | | | | |
| 26-1 | The still shows the Competition name, the Leaderboard and the Game log | `pnpm e2e e2e/about-games.spec.ts` after step 8; orchestrator reads the card screenshot (Read tool); `about-media.ts`'s in-code frame assertion | Chrome, Chromium | in the rendered 16:9 card: "Bouncy Pong" at the top, the Leaderboard heading and the first Game row visible, nothing cropped; the script's assertion passed (log line) | `test-results/e2e/regression-r3-about/about-games.png`; `public/about/games.png`; `test-results/28-splash/log.txt` | step 8 | `about-media.ts`, the Competition page, `about-feature-grid.tsx` |
| 26-2 | Regenerated with `scripts/about-media.ts`; the `/about` screenshot updated | `pnpm tsx scripts/about-media.ts --stills` log; 26-1's spec | Chrome, local Postgres | log names every still; card screenshot shows the new still | `test-results/28-splash/`, `test-results/e2e/regression-r3-about/about-games.png` | step 8 | any still |
| E-1 | Ticket 13 closed as moot or rescoped, with a comment — **human gate** | prerequisite: this plan approved; human action: done, Paul answered decision 11 "moot" at plan approval (2026-09-29); expected: closed as moot; post-check: `13-admin-theming.md` carries `Status: wontfix` (or the rescope) and a dated comment in the closeout commit | none | as answered | the closeout commit | plan approval | — |
| E-2 | Each ticket records its closeout and is `done` in this branch | `grep -n "Status" .scratch/regression-2026-09/issues/{12,22,26}-*.md` | none | `**Status:** done` and `[CLOSEOUT]` in the final commit | the closeout commit | closeout | — |
| E-3 | CI on the PR runs smoke and e2e, and passes | `gh pr checks <n>` | GitHub Actions, Postgres service | all green (lint, format, typecheck, migrate on a fresh DB, drift, test, build, smoke, e2e with the new spec and dependency) | PR checks URL in the closeout | after the PR | any push |
| E-4 | `pnpm gate` passes locally | as 12-6 | | | | | |

### Candidate evidence (planning)

- **Derivation rule reaches AA on every seed (12-1, partial).**
  `pnpm exec tsx <scratch>/derive.ts` and `base.ts` at `staging`
  `a74d4df`, 2026-09-29: for each `seeds/*.json`, decision 2's rule with no
  overrides, run through the current `warWeekThemeStyle`; lowest ratios in
  the derived scheme across the eleven seeds — foreground on background
  13.9, muted-foreground on background 6.1, primary-text on background 4.5
  (ix), primary-foreground on primary 5.1, accent-foreground on accent 5.0,
  accent on background 4.5 (iv), foreground on muted 12.2. In the base
  scheme foreground on muted is ≥ 10.52 across both schemes (viii's
  derived palette, per the re-review's `rt2.ts`); muted-foreground on muted
  is 4.12 on viii and 4.53 on vii, which is why decision 8 uses
  `text-foreground`, not `text-muted-foreground`, on a muted surface. The
  base scheme's other pairs already pass (`archive-contrast.test.ts`).
  Reuse: the test in step 1 must encode the same rule; invalidated by any
  change to `readableText` / `readableOn`, to the rule, or to a seed
  palette.
- **XI's override candidate:** `#0a7a1f` on `#d1ffd6` is 4.97:1, white on
  it 5.50:1 (`tsx -e` with `contrastRatio`, same date).
- **`@axe-core/playwright` 4.13.0 is on the registry** (`pnpm view`,
  2026-09-29); `axe-core` 4.13.0 is already in the lockfile transitively.
- **Existing checks this plan knowingly rewrites:** `e2e/theme.spec.ts`
  (three tests keyed on the *theme*'s scheme; after this epic the scheme
  is the *viewer*'s, so `/x` under Dark is dark and `/history` follows the
  choice); `scripts/smoke/archive.ts:17,44` and `scripts/smoke/setup.ts:155`
  (`--primary:<hex>` substrings, now `--<scheme>-primary:<hex>`);
  `src/lib/theme.test.ts`'s `toEqual` of the style shape.

### Considerations required by `planning.md`

- **Drizzle schema change (confirmed team policy):** red-teamed (record
  below); migration and seed loader in one step (2); smoke loads every seed
  twice on seeded local Postgres (12-4).
- **Auth / access:** untouched. The Display is client-only state; no
  action, `can` rule or `authorize` path changes.
- **Finale:** follows the viewer's scheme through the edition layout's
  root; it never reorders or recomputes Standings (no Finale code changes).
- **Vertical-slice gate:** typecheck, lint, vitest, build, smoke and e2e
  at steps 3, 6, 7 and 9; on failure stop and report.
- **MCP:** no tool change; `/api/mcp` untouched (decision 13).
- **Stairs:** not involved.
- **Tooling:** Context7 for Base UI `ToggleGroup`, Tailwind v4
  `:where()` / `@theme inline` behaviour, `next/script` and
  `@axe-core/playwright`'s `AxeBuilder` API when writing steps 4–6.

### Red-team review

Reviewer: a fresh `atlas-red-team-reviewer` (2026-09-29), given only the
fixed contract, the draft plan and repository paths; read-only. It
reproduced the plan's contrast numbers with its own script. One revision
cycle. Blocking findings and their dispositions:

| # | Finding | Disposition |
|---|---|---|
| 1 | `muted-foreground` on `muted` (the first disabled-button pair) is 4.12:1 on War Week VIII's base palette; 12-1/22-1 would fail | resolved: decision 8 uses `disabled:text-foreground` on `bg-muted` (≥ 10.52:1 everywhere, per the re-review); the pair in 12-1 is `foreground` on `muted`; base-scheme evidence recorded |
| 2 | `scripts/smoke/archive.ts:17,44` and `setup.ts:155` assert `--primary:<hex>` and would fail once tokens are prefixed | resolved: decision 12 and the areas table name the three rewrites (`--<scheme>-primary:`), owned by D2c |
| 3 | The `/about` card renders stills `aspect-video object-cover object-top`, so a taller Games still is cropped back; 26-1 checked the PNG, not the card | resolved: decision 9 captures a 16:9 frame at 1600 × 900 (scale 1.6) with an in-code frame assertion; 26-1 is proved on the rendered card screenshot |
| 4 | A named `ColorField` showing the derived hex posts it, so any settings save would store all five overrides and end automatic derivation | resolved: decision 7 uses unnamed `ColorField`s with hidden `overrideX` inputs (override or `""`); 12-9 proves an untouched save leaves the columns null through the real form |
| 5 | 12-8 asserted `<html>` `color-scheme`, which flips on every page and proves nothing about the Finale, Archive, `/about`, `/admin` or sign-in | resolved: decision 12 and rows 12-2/12-8 assert the themed root's (and on `/history` the body's and a card's) computed background against the expected palette per scheme |
| 6 | The no-flash check couldn't isolate the inline script (a `domcontentloaded` handler may run after hydration); the smoke half had no owner | resolved: 12-7 aborts every `_next/static` request so only the script can set the attribute and the dark background; the `<head>` check is in `scripts/smoke/pages.ts`, D2c |

Non-blocking findings, all resolved in the plan: exact selectors and
order for the CSS, `:where()` only on the themed-root rules (decision 3);
staged derivation so an override re-derives its dependents, and overrides
cleared when the base crosses the light/dark boundary (decision 2, tested
in 12-9); `optional(seed.overrideX)` and optional `override*` on
`ThemeColors` (decision 6); the raw-primary fills recorded as an exclusion
and in CONTEXT.md (decision 13); the seed → row → page path made real with
XI's one override (decision 6, 12-4); a `copySettings` test (12, step 2);
an axe baseline on `staging` and `incomplete` review (step 0, 12-3); a
computed-style assertion for 22 (22-1); the false "typecheck forces the
smoke inputs" claim replaced by explicit edits (areas table); the `dark:`
rationale corrected and the hard-coded amber warnings moved to a
`--warning` token (decision 3); "Appearance" renamed **Display** and
"other palette" dropped for "derived palette" (decision 1);
`docs/agents/testing.md`'s stale e2e sentence (decision 16); ticket 13's
closure made a human gate (decision 11, E-1); same-tab change event,
`aria-label`s, the `next/script` fallback and the pending-button
consequence recorded (decisions 4, 5, 8).

Re-review of the revised plan (same day, fresh reviewer, its own
contrast script `rt2.ts`): B1, B2, B4, B5 resolved; B3 resolved with a
packet note; B6 not resolved. Two new blocking findings, both fixed in
this revision without a further review cycle (the fixes are the
reviewer's own):

| # | Finding | Disposition |
|---|---|---|
| N1 | 12-7's `**/_next/static/**` abort also blocks `globals.css` (`_next/static/chunks/*.css`), so the dark background can't appear even with a working script | resolved: abort only `resourceType() === "script"` (decision 12, 12-7); B6 now resolved |
| N2 | XI's seeded `#0a7a1f` override contradicts 12-9's "untouched save → null", the smoke/e2e `finally` null restores, and smoke's settings input that doesn't read the override columns | resolved: untouched save leaves each `override_*` unchanged; every `finally` restores what it read; smoke inputs read all five columns; the seeded override is asserted before anything edits XI (decisions 6, 12; 12-9; fixtures) |

Non-blocking, all applied: B3's sticky-header frame check and a
1920 × 1080 fallback (decision 9); B5's `oklch()` string comparison on
`/history` (decision 12); a picker opened and dismissed no longer creates
an override, and a scheme flip keeps overrides set after it (W-a, W-b;
decisions 2, 7; 12-9); a per-palette `--warning` via `readableText`
(W-c, decision 3); a non-colour disabled cue (W-d, decision 8); the
outline and foreground-on-muted figures corrected to 5.36 and 10.52
(W-e); `about.test.ts` updated in D1b (W-f); the axe baseline moved out of
the wiped folder and committed (W-g); the CONTEXT.md section named "Light
and dark Display rules" with a display-name note (W-h); `ww:display`
pinned with `addScriptToEvaluateOnNewDocument` (decision 10).

## Execution

Claimed 2026-09-30 by `/atlas-implement` (work package `regression-r2`;
state `.claude/atlas-state/regression-r2.json`). Epic and tickets 12, 22, 26
`ready-for-agent` → `in-progress`; 13 stays `needs-info` until closeout
(E-1, answered "moot" at plan approval). Comparison SHA `a74d4df`.

**Checkout and isolation:** direct checkout on
`feat/regression-r2-light-dark`, sequential, no worktrees. Every
deliverable runs `pnpm e2e` (port 3200, resets every seed in the one local
Postgres), so no two can run their proofs at once; and the predicted file
collisions between neighbours are real: D1 and D2 both edit
`src/lib/theme.ts` (D1 emits the `--light-*`/`--dark-*` tokens, D2 maps
them in CSS and adds `--warning`), `src/components/war-week-settings-form.tsx`
(D1 the override group, D2 `--warning`) and `scripts/smoke/setup.ts` (D1
the override columns in the input, D2 the `--<scheme>-primary` rewrite and
round-trip). D3 and D4 touch disjoint files (`button.tsx` /
`enrollment.spec.ts` vs `about-media.ts`, `/about`, docs) and are
serialized only by the shared e2e port and database — re-checked at
closeout.

**Deliverables** (one worker each; plan steps in brackets):

| Id | Slice | Steps | Model |
|---|---|---|---|
| D0 | axe dependency and baseline on the unchanged app | 0 | Sonnet |
| D1 | derivation, schema + seed, Setup form (decisions 2, 6, 7) | 1–3 | Opus |
| D2 | CSS and roots, Display control, smoke + e2e proofs (decisions 3, 4, 5, 12) | 4–6 | Opus |
| D3 | Button disabled look, ticket 22 (decision 8) | 7 | Sonnet |
| D4 | showcase stills, copy, docs, ticket 13 closure (decisions 9, 10, 11, 16) | 8 | Sonnet |

Edges: D0 → D1 → D2 → D3 → D4; the gate (step 9) and closeout are the
orchestrator's. The verification map above is the criterion-level mapping;
the ledger in the state record seeds every criterion `unproven`.
Human gates: E-1 only, already answered (post-check at closeout).
Proof root not cleared (Paul's R1 decision, kept since).

## [AI CODE REVIEW]

2026-09-30, aggregate review of `a74d4df..f00f355` by two fresh Opus
reviewers (one per axis), adjudicated by the orchestrator against the cited
hunks. Fixes in `f279858` (code) and `f7c85d5` (regenerated media and
evidence); F1 and F2 were proved red first.

**Technical implementation and spec conformity**

| # | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| F1 | blocking | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` | theme style on a plain `div`, no `data-theme-root`: both pages lost XI's theme | resolved: `ThemeRoot`; added to 12-8's e2e |
| F2 | blocking | `src/components/war-week-settings-form.tsx` | every edit crossing light/dark cleared overrides, so a flip and back (e.g. typing `#1a1a1a` via `#1a1`) wiped them with no notice | resolved: clear on leaving the saved scheme, restore the saved overrides on return; e2e step types that case |
| F3 | non-blocking | `e2e/theme.spec.ts` | "open and dismiss the picker" used an overridden field, so it couldn't catch a derived color freezing | resolved: uses a derived field |
| F4 | non-blocking | `src/components/display-menu.tsx` | another tab's change updated the control, not the page | resolved: shared `applyDisplay` on the `storage` event |
| F5 | non-blocking | `src/components/display-menu.tsx` | control ignored the page's scheme when storage throws | resolved: snapshot falls back to `html[data-display]` |
| F6 | non-blocking | `src/lib/setup.ts` | comment said omitted override keys are kept; through the action they become null | resolved: comment states both paths |
| F7 | non-blocking | `more-menu.tsx`, `[edition]/more/page.tsx` | labelled Display row could overflow at 320–360px | resolved: row wraps |
| F8 | non-blocking | `src/components/ui/button.tsx` | decision 8's `disabled:cursor-not-allowed` omitted | deviation approved: the base keeps `disabled:pointer-events-none`, so a cursor never shows; the dashed border is the non-colour cue |
| F9 | non-blocking | `e2e/enrollment.spec.ts` | outline (Withdraw / Leave) disabled look unasserted | resolved: Withdraw asserted (muted text, dashed border) |
| F10 | non-blocking | `docs/maintainers-guide.md` | `--warning` users listed wrongly | resolved |
| F11 | non-blocking | `scripts/about-media.ts` | "Game logged" toast in the Games still | resolved: waits for the toast; still regenerated |

**Coding standards**

| # | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| S1 | non-blocking | form, `theme.ts`, `scripts/smoke/setup.ts` | "mode" meaning color scheme, beside CONTEXT's Mode | deviation approved: the UI copy ("Light mode colors", "Dark mode: …") is prescribed by decisions 2 and 7 and reads as plain English; comments and test names say "scheme" |
| S2 | non-blocking | form | flip notice not `text-warning` | resolved |
| S3 | non-blocking | form, `src/lib/theme.ts` | `isHexPalette` / override mapping duplicated in the form | resolved: imported from `theme.ts` |
| S4 | non-blocking | e2e specs, `theme-root.tsx` | redeclared `ColorScheme` / `Display` and the `ww:display` literal | resolved: imported |
| S5 | non-blocking | `src/lib/display.ts` | `parseDisplay` doc comment inaccurate | resolved |

Coverage judged sufficient: the two axes together read every deliverable
(D0–D4) and every plan decision; the spec axis listed each AC and
decision with a verdict. Remaining risks: see Follow-ups.

## [CLOSEOUT]

2026-09-30. PR https://github.com/paul-macfarlane/jg-war-week/pull/94 into
`staging`. Repository delivery `war-weeker`, branch
`feat/regression-r2-light-dark`, comparison `a74d4df`, verified at
`f7c85d5` (evidence commit `d4c8fac`).

**Deliverables**

| Id | Commit | Worker | Result |
|---|---|---|---|
| D0 | `afff8ea` | Sonnet | axe spec and baseline; committed by Paul (the Atlas secret-scrub hook denies `pnpm-lock.yaml` integrity hashes) |
| D1 | `22d6cb1` | Opus | derivation, override columns (0017), seed, Setup form |
| D2 | `ab66fb4`, `373f30e` | Opus | CSS, no-flash script, Display control, smoke and e2e |
| D3 | `0fb29c5` | Sonnet | disabled button look (22) |
| D4 | `f00f355` | Sonnet | Games still (26), `/about` copy, docs |
| R1 | `f279858`, `f7c85d5` | Opus | review fixes |

**Isolation re-check.** Sequential in one checkout. D1 and D2 did collide
as predicted on `src/components/war-week-settings-form.tsx` and
`scripts/smoke/setup.ts`, and also on `src/components/theme-root.tsx` and
`src/app/[edition]/layout.tsx`; the predicted `src/lib/theme.ts` collision
did not happen (D2 left it alone). D3 and D4 touched disjoint source files,
as predicted, and were serialized only by the shared e2e port and database.

**Verdicts** (command: `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate`,
exit 0 at `f7c85d5`: 3053 unit tests, build, 201 smoke checks, 43
Playwright tests; `test-results/r2-gate/gate.txt`)

| Id | Verdict | Evidence |
|---|---|---|
| 12-1 | PASS | `theme.test.ts`, `archive-contrast.test.ts` (11 seeds × 2 schemes, every pair ≥ 4.5:1; lowest 4.53, the light warning on vii) in `gate.txt` |
| 12-2 | PASS | `e2e/theme.spec.ts` XI and X Display tests in `gate.txt`; `test-results/e2e/theme-Display-*/xi-light.png`, `xi-dark.png` |
| 12-3 | PASS | `e2e/axe.spec.ts`: zero `color-contrast` violations on `/xi`, `/history`, `/about` × 2 (`test-results/e2e/axe-*/`). `incomplete`: one `color-contrast` entry each on `/history` and `/about` (text over banner images and `/about`'s gradient, which axe can't measure), the same as the baseline (`test-results/r2-axe-baseline/`). `/xi`'s `aria-allowed-attr`, `aria-prohibited-attr`, `button-name` violations are inherited and out of scope (see Follow-ups) |
| 12-4 | PASS | migration 0017 applies; `db:generate` reports no changes; smoke loads every seed twice and asserts XI's seeded override stored and served as `--light-primary`; red-team record above |
| 12-5 | PASS | `/about` hero copy; the guide's theme recipe; `test-results/28-splash/` regenerated (incl. `about-desktop-light.png`) |
| 12-6 | PASS | `gate.txt` |
| 12-7 | PASS | no-flash e2e (scripts aborted, CSS loaded) and smoke's `<head>` script check in `gate.txt` |
| 12-8 | PASS | e2e: the Finale, `/history` (body and X's card), `/about`, `/privacy`, `/terms`, sign-in, `/admin/setup` × 2 schemes; `theme-every-themed-surface-*/history-dark.png` |
| 12-9 | PASS | e2e Setup path (untouched save, dismissed picker, flip-and-back, override, reset) and smoke round-trip in `gate.txt`; `theme-Setup-*/setup-overrides.png`; `src/mutations/setup.test.ts` |
| 22-1 | PASS | computed style (muted fill ≠ primary, dashed) in Light and Dark, Withdraw muted and dashed; `test-results/e2e/enrollment-closed-refused/375.png`, `375-dark.png` |
| 22-2 | PASS | as 22-1 |
| 22-3 | PASS | `gate.txt` |
| 26-1 | PASS | frame 1600×900 held (h1 top 125 ≥ header bottom 57; first Game row bottom 560 ≤ 900); card read in `test-results/e2e/regression-r3-about/about-games.png` |
| 26-2 | PASS | `about-media.ts --stills` log in `test-results/28-splash/`; `public/about/games.png` |
| E-1 | PASS | Paul answered decision 11 "moot" at plan approval; ticket 13 `wontfix` with a comment in this commit |
| E-2 | PASS | 12, 22, 26 and the epic `done` with `[CLOSEOUT]` in this commit |
| E-3 | pending | CI on PR #94 at closeout |
| E-4 | PASS | `gate.txt` |

**Deviations:** F8 and S1 above; the approved execution deviations
recorded in the review packets (override keys read in the form; column-
derived names; flip clearing keyed on stored values; axe waits for
animations; `/history` body compared as `lab()`; `"system"` stored
explicitly; `.dark` block folded into the dark rules). The committed e2e
screenshots of other specs now show XI's derived light palette (Playwright's
System is light).

**Follow-ups (not in this epic):**
- In Chromium, Setup's color `FieldGroup`s collapse to 0px when the
  contrast-warnings list appears (container-query sizing,
  `@container/field-group` in `src/components/ui/field.tsx`); the pieces
  exist on `staging`. The e2e works around it. Pending Paul's call on a
  ticket.
- `/xi`'s inherited axe findings (`aria-allowed-attr`,
  `aria-prohibited-attr`, `button-name`).
- The Atlas secret-scrub hook blocks any commit touching `pnpm-lock.yaml`.
