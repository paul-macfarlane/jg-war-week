import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  participant,
  seriesMatch,
  seriesMatchEntrant,
  team,
} from "@/db/schema";
import type { ResultFact } from "@/lib/logged-results";
import { type SeriesConfig, seriesConfigSchema } from "@/lib/series/config";
import type { MatchInput } from "@/lib/series/input";
import {
  MATCH_MISSING,
  NOT_LINKED,
  playersRuleError,
  seriesChangeError,
  seriesLogError,
} from "@/lib/series/log-rule";
import { loggedMatchesSettingsError } from "@/lib/series/settings-rule";
import { refuse } from "@/mutations/brackets";
import { type LoggedRun, lockedLogged } from "@/mutations/logged-results";
import type { MutationContext, MutationResult } from "@/mutations/types";
import {
  type SeriesLogFacts,
  getSeriesLogFacts,
} from "@/queries/logged-results";

export const NOT_HEAD_TO_HEAD = "This Competition isn't run as Head-to-head.";
/** A closed Head-to-head's settings can't change. */
export const SERIES_CLOSED = "Reopen the Competition first.";
const NOT_A_WAR_WEEK_TEAM = "Every player must be a Team of this War Week.";
const NOT_A_WAR_WEEK_PARTICIPANT =
  "Every player must be a Participant of this War Week.";

/** The Head-to-head locked with its facts reloaded inside the lock. */
async function lockedSeries(
  tx: DBOrTx,
  competitionId: string,
  matchId: string | null,
  playerIds: string[],
  ctx: MutationContext,
): Promise<{ found: LoggedRun; facts: SeriesLogFacts } | string> {
  const found = await lockedLogged(tx, competitionId, ctx);
  if (typeof found === "string") return found;
  if (found.format !== "head-to-head") return NOT_HEAD_TO_HEAD;
  const facts = await getSeriesLogFacts(
    competitionId,
    matchId,
    ctx.actorEmail,
    playerIds,
    tx,
  );
  return facts ? { found, facts } : NOT_HEAD_TO_HEAD;
}

/**
 * Why the posted players can't be a Match here, for everyone (Hosts
 * included), or null: they must be Teams (team scoring) or Participants
 * (individual) of this War Week, and the series' two Entrants.
 */
async function playersError(
  tx: DBOrTx,
  found: LoggedRun,
  facts: SeriesLogFacts,
  input: MatchInput,
  ctx: MutationContext,
): Promise<string | null> {
  const ids = input.players.map((p) => p.id);
  const table = found.scoring === "team" ? team : participant;
  const valid = ids.length
    ? await tx.$count(
        table,
        and(inArray(table.id, ids), eq(table.warWeekId, ctx.warWeekId)),
      )
    : 0;
  if (valid !== new Set(ids).size) {
    return found.scoring === "team"
      ? NOT_A_WAR_WEEK_TEAM
      : NOT_A_WAR_WEEK_PARTICIPANT;
  }
  return playersRuleError({
    scoring: found.scoring,
    ids,
    entrants: facts.seriesLog.entrants,
  });
}

/** A Match's two sides as rows, by the Entrant each posted player is. */
async function insertSides(
  tx: DBOrTx,
  seriesMatchId: string,
  facts: SeriesLogFacts,
  input: MatchInput,
) {
  const entrantOf = (id: string) =>
    facts.entrants.find((e) => (e.teamId ?? e.participantId) === id)!;
  await tx.insert(seriesMatchEntrant).values(
    input.players.map((p) => ({
      seriesMatchId,
      entrantId: entrantOf(p.id).id,
      place: p.place,
      score: p.score,
    })),
  );
}

/**
 * Logs a Head-to-head Match (ADR 0011) between the Competition's two
 * Entrants: under the Competition's row lock, reloads the facts with the
 * posted players and checks them again (so a log after Close or a decided
 * series is refused), validates the players, and records who logged it:
 * the email for audit, and the linked Participant (null for a Host or
 * Organizer).
 */
export async function logMatch(
  competitionId: string,
  input: MatchInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<{ ok: true; resultId: string } | { ok: false; error: string }> {
  return dbOrTx.transaction(async (tx) => {
    const locked = await lockedSeries(
      tx,
      competitionId,
      null,
      input.players.map((p) => p.id),
      ctx,
    );
    if (typeof locked === "string") return refuse(locked);
    const { found, facts } = locked;
    const refusal = seriesLogError(facts.seriesLog);
    if (refusal) return refuse(refusal);
    const invalid = await playersError(tx, found, facts, input, ctx);
    if (invalid) return refuse(invalid);
    if (!facts.seriesLog.runs && !facts.linked) return refuse(NOT_LINKED);

    const [row] = await tx
      .insert(seriesMatch)
      .values({
        competitionId,
        loggedByEmail: ctx.actorEmail,
        loggedByParticipantId: facts.seriesLog.runs
          ? null
          : facts.linked!.participantId,
      })
      .returning({ id: seriesMatch.id });
    await insertSides(tx, row.id, facts, input);
    return { ok: true, resultId: row.id };
  });
}

/**
 * Changes a Match's result (ADR 0011): anyone who could have logged it (a
 * Host or Organizer, or with self-report on either Entrant or anyone on an
 * Entrant Team), whoever logged it, while the Competition is open, checked
 * again under the lock.
 * Replaces its sides and bumps `updated_at`; its recorded time never
 * changes.
 */
export async function updateMatch(
  competitionId: string,
  matchId: string,
  input: MatchInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const locked = await lockedSeries(
      tx,
      competitionId,
      matchId,
      input.players.map((p) => p.id),
      ctx,
    );
    if (typeof locked === "string") return refuse(locked);
    const { found, facts } = locked;
    const refusal = seriesChangeError(facts.seriesLog);
    if (refusal) return refuse(refusal);
    if (facts.seriesLog.match === "missing") return refuse(MATCH_MISSING);
    const invalid = await playersError(tx, found, facts, input, ctx);
    if (invalid) return refuse(invalid);

    await tx
      .delete(seriesMatchEntrant)
      .where(eq(seriesMatchEntrant.seriesMatchId, matchId));
    await insertSides(tx, matchId, facts, input);
    await tx
      .update(seriesMatch)
      .set({ updatedAt: sql`now()` })
      .where(eq(seriesMatch.id, matchId));
    return { ok: true };
  });
}

/**
 * Deletes a Match (ADR 0011): anyone who could have logged it, whoever
 * logged it, while the Competition is open.
 */
export async function deleteMatch(
  competitionId: string,
  matchId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const locked = await lockedSeries(tx, competitionId, matchId, [], ctx);
    if (typeof locked === "string") return refuse(locked);
    const refusal = seriesChangeError(locked.facts.seriesLog);
    if (refusal) return refuse(refusal);
    if (locked.facts.seriesLog.match === "missing") {
      return refuse(MATCH_MISSING);
    }
    await tx
      .delete(seriesMatch)
      .where(
        and(
          eq(seriesMatch.id, matchId),
          eq(seriesMatch.competitionId, competitionId),
        ),
      );
    return { ok: true };
  });
}

/** This Head-to-head's Matches with their sides' places, for the settings rule. */
async function loggedMatches(
  tx: DBOrTx,
  competitionId: string,
): Promise<Pick<ResultFact, "players">[]> {
  const rows = await tx
    .select({
      seriesMatchId: seriesMatchEntrant.seriesMatchId,
      entrantId: seriesMatchEntrant.entrantId,
      place: seriesMatchEntrant.place,
    })
    .from(seriesMatchEntrant)
    .innerJoin(
      seriesMatch,
      eq(seriesMatch.id, seriesMatchEntrant.seriesMatchId),
    )
    .where(eq(seriesMatch.competitionId, competitionId));
  const byMatch = new Map<string, Pick<ResultFact, "players">>();
  for (const row of rows) {
    const match = byMatch.get(row.seriesMatchId) ?? { players: [] };
    match.players.push({ id: row.entrantId, place: row.place, score: null });
    byMatch.set(row.seriesMatchId, match);
  }
  return [...byMatch.values()];
}

/**
 * Saves a Head-to-head's draws and Best of (R3 decision 11). The logged
 * Matches must still fit (`loggedMatchesSettingsError`). Refused while
 * closed and on another Format.
 */
export async function setSeriesConfig(
  competitionId: string,
  input: SeriesConfig,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLogged(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.format !== "head-to-head") return refuse(NOT_HEAD_TO_HEAD);
    if (found.closedAt) return refuse(SERIES_CLOSED);
    const config = seriesConfigSchema.safeParse(input);
    if (!config.success) return refuse(config.error.issues[0].message);
    const misfit = loggedMatchesSettingsError(
      config.data,
      await loggedMatches(tx, competitionId),
    );
    if (misfit) return refuse(misfit);
    await tx
      .update(competition)
      .set({ seriesConfig: config.data, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}
