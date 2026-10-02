# 67: Import the roster from a spreadsheet

**What to build:** On the roster admin, **Import** opens a sheet/dialog where an Organizer pastes cells copied from Google Sheets (tab-separated, with or without a header row) or uploads a CSV. Columns: name, email, team, company tag, leader. A preview lists every row as **Add**, **Update** (an existing email on this War Week's roster: shows what changes) or **Error** (bad email, unknown team, duplicate name) before **Import** commits all valid rows in one transaction.

**Blocked by:** none (uses the list pattern from ticket 58 if R9 has merged)

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A6; grilling Q16

## Decisions

- Header matching is case-insensitive and forgiving ("Full name", "Email address"); a pasted Google Form export maps by header; without a header, the column order above.
- Team by name; an unknown team is an error, not a create. In free-for-all the team and leader columns are ignored.
- Email optional (ticket 52); rows without one are matched by nothing and always Add.
- Parsing is a pure, unit-tested module; the write is one mutation through `authorize` (Organizer-only, like the roster).

## Acceptance criteria

- [ ] Unit tests: TSV and CSV (quoted commas), header and headerless, update-by-email ignoring case, every error kind.
- [ ] e2e: paste three rows (one existing email), preview shows 2 Add and 1 Update, import, the roster shows them.
- [ ] `pnpm gate` passes.
