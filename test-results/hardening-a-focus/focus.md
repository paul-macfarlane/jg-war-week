# 09-AC2: focus after deleting a setup row (and the delete dialog's pending state)

Commit `86b1af6`. Production build (from `pnpm gate`) served with `pnpm start -p 3300` on the local, seeded Postgres, signed in as a made-up local Organizer (`evidence-organizer@jahnelgroup.com`, removed afterwards). Throwaway Competitions with no Points Entries were inserted, then deleted through each row's Delete button and the confirm dialog, driven by Playwright on `/admin/setup/competitions`.

| Screenshot | Deleted | Before | Confirm button while pending | `document.activeElement` after the row left |
|---|---|---|---|---|
| `middle-row.png` | "Evidence first" (XI) | row 9 of 24; next "Evidence second" | "Delete…" shown | Name input of the next row, "Evidence second" |
| `middle-row-2.png` | "Evidence second" (XI) | row 9 of 23; next "Guns, Lots of Guns" | "Delete…" shown | Name input of the next row, "Guns, Lots of Guns" |
| `empty-list.png` | "Evidence only one" (War Week V, via the edition switcher's `admin_edition` cookie) | the only row | "Delete…" shown | the **Add Competition** button (`button[type=submit]` in the add row) |

Focus never fell to `<body>`.

A first run on `e2ed4ee`, before the review fix, found the emptied list focusing the add row's first input, not the Add button. Fixed in `86b1af6`.

Deleting the last row of a non-empty list focuses the previous row. The AC doesn't name this case; it's covered by `src/lib/setup-row-focus.test.ts` and recorded as an interpretation in the review.
