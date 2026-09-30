# axe baseline — unchanged app

Baseline run of `e2e/axe.spec.ts` against the unchanged app at commit
`a74d4df`, taken 2026-09-29, before any light/dark work in this epic
lands. Six analyses: `/xi` (signed in as the Participant), `/history`,
`/about`, each in `light` and `dark` (`page.emulateMedia`; `/xi` still
renders its own dark theme regardless of the emulated scheme). Tags:
`wcag2a`, `wcag2aa`.

Command:

```
set -a; . ./.env.example; set +a
pnpm build && pnpm e2e e2e/axe.spec.ts
```

## Counts by rule id

| File | violations | incomplete |
| --- | --- | --- |
| `xi-light.json` | aria-allowed-attr: 1, aria-prohibited-attr: 1, button-name: 1 | (none) |
| `xi-dark.json` | aria-allowed-attr: 1, aria-prohibited-attr: 1, button-name: 1 | (none) |
| `history-light.json` | (none) | color-contrast: 1 |
| `history-dark.json` | (none) | color-contrast: 1 |
| `about-light.json` | color-contrast: 1 | color-contrast: 1 |
| `about-dark.json` | color-contrast: 1 | color-contrast: 1 |

`/xi`'s violations (`aria-allowed-attr`, `aria-prohibited-attr`,
`button-name`) are pre-existing and unrelated to color; not this epic's
concern but recorded here since the spec asserts only on
`color-contrast`. `/about`'s `color-contrast` violation and both pages'
`incomplete` `color-contrast` entries are the inherited findings this
epic's later deliverables (light/dark palette work) either fix or
review for real regression.
