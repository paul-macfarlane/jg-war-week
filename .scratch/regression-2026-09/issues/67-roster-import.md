# 67: Import the roster from a spreadsheet

**What to build:** On the roster admin, **Import** opens a sheet/dialog where an Organizer pastes cells copied from Google Sheets (tab-separated, with or without a header row) or uploads a CSV. Columns: name, email, team, company tag, leader. A preview lists every row as **Add**, **Update** (an existing email on this War Week's roster: shows what changes) or **Error** (bad email, unknown team, duplicate name) before **Import** commits all valid rows in one transaction.

**Blocked by:** none (uses the list pattern from ticket 58 if R9 has merged)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A6; grilling Q16

## Decisions

- Header matching is case-insensitive and forgiving ("Full name", "Email address"); a pasted Google Form export maps by header; without a header, the column order above.
- Team by name; an unknown team is an error, not a create. In free-for-all the team and leader columns are ignored.
- Email optional (ticket 52); rows without one are matched by nothing and always Add.
- Parsing is a pure, unit-tested module; the write is one mutation through `authorize` (Organizer-only, like the roster).

## Acceptance criteria

- [x] Unit tests: TSV and CSV (quoted commas), header and headerless, update-by-email ignoring case, every error kind.
- [x] e2e: paste three rows (one existing email), preview shows 2 Add and 1 Update, import, the roster shows them.
- [x] `pnpm gate` passes.

## Comments

## [AI CODE REVIEW]

See `../epics/R11-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r11-content`. AC1 PASS (`src/lib/roster-import.test.ts`); AC2 PASS (`e2e/regression-r11-roster-import.spec.ts`: 2 Add, 1 Update, imported); AC3 PASS (gate). Also: Organizer-only refusal over HTTP for Host and Participant (smoke). Empty cell clears (H2); a short row's missing cells stay unchanged. Commits `27c1d45`, orchestrator fix, `de713eb`. Full record: `../epics/R11-execution.md` [CLOSEOUT]. PR: https://github.com/paul-macfarlane/jg-war-week/pull/118
