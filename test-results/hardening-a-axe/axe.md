# 09-AC1: axe colour contrast on /history, /x, /i

- axe-core 4.13.0, rule `color-contrast` only, injected into the page.
- Production build (`pnpm build`) served with `pnpm start -p 3300` against the local Postgres (compose, localhost:2345) after `pnpm gate` had loaded every seed.
- Signed in with a locally minted session for a made-up Organizer (`evidence-organizer@jahnelgroup.com`), removed afterwards.
- Viewports: 1280×900 (desktop, full-page screenshots `*-desktop.png`) and 390×844 (phone, viewport screenshots `*-phone.png`).

## First run (D09 as delivered): 6 violations on /history

All six were the Archive card's "Original wiki page" footer link (`text-primary-text`, 12px) on the card footer's `bg-muted/50` surface: 4.03–4.19:1 (War Weeks I, II, III, V, VI, and the first card). D09's contrast test measured primary text against the card, not the footer. `/x` and `/i`: 0 violations.

Orchestrator fix: the footer link is `text-foreground` (still underlined), and `src/lib/archive-contrast.test.ts` now also checks foreground on the footer surface (`bg-muted/50` over the card) for every seed.

## Second run (after the fix)

| Page | Viewport | Violations | Passing nodes | Incomplete |
|---|---|---|---|---|
| /history | desktop | 0 | 59 | 4 |
| /x | desktop | 0 | 35 | 0 |
| /i | desktop | 0 | 27 | 0 |
| /history | phone | 0 | 59 | 4 |
| /x | phone | 0 | 30 | 0 |
| /i | phone | 0 | 22 | 0 |

The 4 incomplete nodes on /history are axe failing to parse the browser's computed `oklch(L C none)` (an achromatic `color-mix` result), not a failure. Measured directly by rasterizing the computed colours in the page (canvas, WCAG relative luminance):

| Node | Text | Foreground | Background | Ratio |
|---|---|---|---|---|
| War Week VII card label | "War Week VII · 2022" | rgb(96, 92, 93) | rgb(247, 243, 234) | 5.95 |
| War Week VII card dates | "Feb 27 – Mar 4, 2022" | rgb(96, 92, 93) | rgb(247, 243, 234) | 5.95 |
| War Week IV card label | "War Week IV · 2019" | rgb(154, 150, 151) | rgb(5, 7, 13) | 6.89 |
| War Week IV card dates | "Feb 24 – Mar 2, 2019" | rgb(154, 150, 151) | rgb(5, 7, 13) | 6.89 |

All above 4.5:1.
