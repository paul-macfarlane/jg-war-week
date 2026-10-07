import { and, eq, ne, or, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type WarWeek, warWeek } from "@/db/schema";
import type { FieldErrors } from "@/lib/result";
import {
  type ClosingValues,
  DEFAULT_SETTINGS,
  type NextWarWeekValues,
  createNextWarWeekError,
  defaultWinner,
  latestWarWeek,
  moveError,
  nextStartDateError,
  transitionError,
  unstartError,
} from "@/lib/war-week-lifecycle";
import { isUniqueViolation } from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getScoredCounts } from "@/queries/scored-counts";
import { getStandings } from "@/queries/standings";

const WAR_WEEK_NOT_FOUND = "That War Week no longer exists.";

/** The edition that is `live` now, other than `exceptId`, if any. */
async function liveEdition(
  dbOrTx: DBOrTx,
  exceptId: string,
): Promise<string | null> {
  const [live] = await dbOrTx
    .select({ edition: warWeek.edition })
    .from(warWeek)
    .where(and(eq(warWeek.status, "live"), ne(warWeek.id, exceptId)))
    .limit(1);
  return live?.edition ?? null;
}

type LifecycleRow = Pick<WarWeek, "status" | "mode" | "winner">;

/**
 * Moves a War Week to `to` when `transitionError` (and, for Start or
 * Reopen, `moveError`; for Unstart, `unstartError`) allows it. A second
 * `live` War Week is refused by the check and, for a concurrent Start that
 * slipped past it, by the `war_week_one_live` index: both read
 * "End <EDITION> first."
 *
 * `set` is either the columns to write, or (for End, which must compute the
 * Winner from the Standings rather than trust client input) a function that
 * derives them from the locked row inside the same transaction.
 */
async function transition(
  warWeekId: string,
  to: WarWeek["status"],
  set:
    | Partial<WarWeek>
    | ((tx: DBOrTx, row: LifecycleRow) => Promise<Partial<WarWeek>>),
  dbOrTx: DBOrTx,
  action?: "start" | "reopen" | "unstart",
): Promise<MutationResult> {
  try {
    return await dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const [row] = await tx
        .select({
          status: warWeek.status,
          mode: warWeek.mode,
          winner: warWeek.winner,
        })
        .from(warWeek)
        .where(eq(warWeek.id, warWeekId))
        .for("update");
      if (!row) return { ok: false, error: WAR_WEEK_NOT_FOUND };
      // Unstart re-reads what is scored under the lock: the action's own
      // check may be stale by now.
      const actionRefusal =
        action === "unstart"
          ? unstartError({
              ...row,
              scored: await getScoredCounts(warWeekId, tx),
            })
          : action && moveError(action, row.status);
      const refusal =
        actionRefusal ||
        transitionError(row.status, to, {
          liveEdition: await liveEdition(tx, warWeekId),
        });
      if (refusal) return { ok: false, error: refusal };
      const resolvedSet = typeof set === "function" ? await set(tx, row) : set;
      await tx
        .update(warWeek)
        .set({ ...resolvedSet, status: to, updatedAt: sql`now()` })
        .where(eq(warWeek.id, warWeekId));
      return { ok: true };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const live = await liveEdition(dbOrTx, warWeekId);
    return {
      ok: false,
      error: live
        ? `End ${live.toUpperCase()} first.`
        : "Another War Week just went live. Refresh and try again.",
    };
  }
}

/** Start War Week: `upcoming → live`, when no other War Week is live. */
export function startWarWeek(
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(ctx.warWeekId, "live", {}, dbOrTx, "start");
}

/**
 * End War Week: `live → complete`, recording highlights and the Winner.
 * The Winner is never taken from `closing` (there is no override): it is
 * `defaultWinner()` over the Standings as of End, computed inside the same
 * transaction that locks the row.
 */
export function endWarWeek(
  closing: ClosingValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(
    ctx.warWeekId,
    "complete",
    async (tx, row) => ({
      ...closing,
      winner:
        defaultWinner(
          await getStandings({ id: ctx.warWeekId, mode: row.mode }, tx),
        ) || null,
    }),
    dbOrTx,
  );
}

/** Reopen: `complete → live` for corrections, when nothing else is live. */
export function reopenWarWeek(
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(ctx.warWeekId, "live", {}, dbOrTx, "reopen");
}

/**
 * Unstart: `live → upcoming`, only for an edition never ended and while
 * nothing is scored (`unstartError`). The Points Entry, Match result and
 * Match and Attempt counts are re-read inside the transaction that locks the row, so
 * one entered after the action's own check is still caught.
 */
export function unstartWarWeek(
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(ctx.warWeekId, "upcoming", {}, dbOrTx, "unstart");
}

/** Why the new edition, edition number or year is taken, or null. */
async function takenError(
  values: NextWarWeekValues,
  dbOrTx: DBOrTx,
): Promise<string | null> {
  const [taken] = await dbOrTx
    .select({
      edition: warWeek.edition,
      editionNumber: warWeek.editionNumber,
      year: warWeek.year,
    })
    .from(warWeek)
    .where(
      or(
        eq(warWeek.edition, values.edition),
        eq(warWeek.editionNumber, values.editionNumber),
        eq(warWeek.year, values.year),
      ),
    )
    .limit(1);
  if (!taken) return null;
  const name = `War Week ${taken.edition.toUpperCase()}`;
  if (taken.edition === values.edition) return `${name} already exists.`;
  if (taken.editionNumber === values.editionNumber) {
    return `Edition number ${values.editionNumber} is already ${name}.`;
  }
  return `${values.year} already has ${name}.`;
}

/**
 * Create next War Week: inserts an `upcoming` War Week with default
 * settings and nothing copied (no Competitions, FAQ, Teams or roster), from
 * the War Week `ctx` names. Refused while the latest War Week by start date
 * is `upcoming` or `live` (`createNextWarWeekError`), and when the new start
 * date isn't after that War Week's end date (`nextStartDateError`). Organizers are global.
 */
export async function createNextWarWeek(
  values: NextWarWeekValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<
  | { ok: true; edition: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors }
> {
  try {
    return await dbOrTx.transaction(async (tx) => {
      const [source] = await tx
        .select({ id: warWeek.id })
        .from(warWeek)
        .where(eq(warWeek.id, ctx.warWeekId));
      if (!source) return { ok: false as const, error: WAR_WEEK_NOT_FOUND };
      const latest = latestWarWeek(await tx.select().from(warWeek));
      const unfinished = createNextWarWeekError(latest);
      if (unfinished) return { ok: false as const, error: unfinished };
      const tooEarly = nextStartDateError(latest, values.startDate);
      if (tooEarly) {
        return {
          ok: false as const,
          error: tooEarly,
          fieldErrors: { startDate: tooEarly },
        };
      }
      const taken = await takenError(values, tx);
      if (taken) return { ok: false as const, error: taken };

      const [created] = await tx
        .insert(warWeek)
        .values({
          edition: values.edition,
          editionNumber: values.editionNumber,
          year: values.year,
          startDate: values.startDate,
          endDate: values.endDate,
          storyTheme: values.storyTheme,
          status: "upcoming",
          ...DEFAULT_SETTINGS,
        })
        .returning({ id: warWeek.id });

      return { ok: true as const, edition: values.edition };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Another Organizer took the edition, number or year meanwhile.
    return {
      ok: false,
      error:
        (await takenError(values, dbOrTx)) ??
        "That War Week already exists. Refresh and try again.",
    };
  }
}
