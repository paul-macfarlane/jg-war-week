# 09-AC2: focus after deleting a setup row (and the delete dialog's pending state)

Production build with `pnpm start -p 3300` on the local, seeded Postgres, signed in as a made-up local Organizer. On `/admin/setup/competitions` (War Week XI), two throwaway Competitions with no Points Entries were inserted: "Aaa Evidence focus first" (first row) and "Zzz Evidence focus last" (last row). Each one was deleted through its Delete button and the confirm dialog, driven by Playwright.

| Deleted | Position | Confirm button while pending | `document.activeElement` after the row left |
|---|---|---|---|
| Aaa Evidence focus first | first of 24 Competition rows | "Delete…" shown | the Name input of the next row, "AI Survey Completion" (`first-row.png`) |
| Zzz Evidence focus last | last row | "Delete…" shown | the Name input of the previous row, "Winning the Day Challenge" (`last-row.png`) |

Focus never fell to `<body>`. The rule, which the unit tests in `src/lib/setup-row-focus.test.ts` cover: next row, else previous row, else the Add row when the list is empty. The ticket names only the next row and the empty list. For the last row, D09 chose the previous row.

The empty-list case (focus goes to the Add row) is covered by the unit test only. Emptying a seeded list in the browser would have meant deleting every row.
