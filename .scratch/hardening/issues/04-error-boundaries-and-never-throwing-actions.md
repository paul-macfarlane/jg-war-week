# 04: Error boundaries; actions never throw

**What to build:** An unexpected database error or bad input shows a friendly error instead of crashing the page.

**Blocked by:** 03 (it sets the action step order)

**Status:** ready-for-agent

## Scope

- Add `src/app/global-error.tsx` and `error.tsx` for the edition pages and `/admin`, inside the themed root, using existing shadcn pieces. Include a "Try again" (reset) link and a home link.
- Every server action wraps unexpected failures (database errors, unique violations such as in `createPointsEntry` or Awards) into its `ActionResult` error. Only redirects and `notFound` propagate.
- Parsers validate the shape before touching fields: `parseWarWeekSettingsInput` (`src/lib/setup.ts:305-307`), `parseCompetitionInput` (`src/lib/setup.ts:358-363`), `createPointsEntry` (`src/actions/points-entries.ts:44`). A malformed call returns an error instead of throwing a TypeError.
- Add `loading.tsx` where it's missing for `competitions/[id]`, `finale` and `more`. Don't add an admin `loading.tsx`: it turns `notFound()` into a 200 (see `.scratch/custom-inputs/execution.md`). Record that constraint in a comment.

## Acceptance criteria

- [ ] A unit test per action family proves a thrown mutation error comes back as `{ ok: false, error }`.
- [ ] Calling each parser with `{}` or wrong types returns an error and doesn't throw.
- [ ] Smoke or Playwright forces an error on a page and sees the error boundary, not Next's default screen.
- [ ] `pnpm gate` passes.

## Comments
