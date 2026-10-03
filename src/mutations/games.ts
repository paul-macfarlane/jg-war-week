import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  entrant,
  game,
  gamePlayer,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import { pointsFor } from "@/lib/bracket/points";
import { type GameFormat, isGameFormat } from "@/lib/enums";
import { gamesConfigSchema } from "@/lib/games/config";
import { enrollmentUnavailable } from "@/lib/games/enroll-rule";
import type { GameInput, GamesSettingsInput } from "@/lib/games/input";
import { placingsOf } from "@/lib/games/leaderboard";
import {
  GAME_MISSING,
  NOT_GAMES,
  NOT_LINKED,
  gameChangeError,
  gameLogError,
  playersRuleError,
} from "@/lib/games/log-rule";
import {
  type LoggedGame,
  loggedGamesSettingsError,
} from "@/lib/games/settings-rule";
import { generatedNote } from "@/lib/points-entry";
import {
  BEST_OF_NEEDS_TWO,
  type BracketCompetition,
  COMPETITION_NOT_FOUND,
  GAMES_CLOSED,
  deleteGenerated,
  lockedCompetition,
  refuse,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import {
  type GameLogFacts,
  getGameLogFacts,
  getGamesLeaderboard,
  sideOf,
} from "@/queries/games";

export const ALREADY_CLOSED = "This Competition is already closed.";
export const GAME_FORMAT_FIXED =
  "A Head-to-head or Best score Competition keeps its Format; add a new Competition to play another.";
export const BEST_OF_NEEDS_FIXED = "A Best of needs a fixed Entrant list.";

type GamesRun = BracketCompetition & { format: GameFormat };

/** Why this Competition can't take a Games write, or null. */
function gamesRefusal(found: BracketCompetition | undefined): string | null {
  if (!found) return COMPETITION_NOT_FOUND;
  if (!isGameFormat(found.format)) return NOT_GAMES;
  return null;
}

async function lockedGames(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<GamesRun | string> {
  const found = await lockedCompetition(tx, competitionId, ctx);
  const refusal = gamesRefusal(found);
  return refusal ?? (found as GamesRun);
}

/**
 * Why the posted players can't be a Game here, or null (R3 decision 10;
 * `playersRuleError`), with whether they're all Teams (team scoring) or
 * Participants (individual) of this War Week counted here. Checked for
 * everyone, Hosts included.
 */
async function playersError(
  tx: DBOrTx,
  found: GamesRun,
  facts: GameLogFacts,
  input: GameInput,
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
  const config = facts.competition?.config;
  return playersRuleError({
    gameFormat: found.format,
    scoring: found.scoring,
    ids,
    allInWarWeek: valid === ids.length,
    bestOf: !!config && "bestOf" in config && config.bestOf !== null,
    entrantsOpen: found.entrantsOpen,
    entrants: facts.gameLog.entrants,
  });
}

/** This Competition's Games, each with its players' ids, names and places. */
async function loggedGames(
  tx: DBOrTx,
  competitionId: string,
): Promise<LoggedGame[]> {
  const rows = await tx
    .select({
      gameId: gamePlayer.gameId,
      teamId: gamePlayer.teamId,
      participantId: gamePlayer.participantId,
      place: gamePlayer.place,
      teamName: team.name,
      participantName: participant.displayName,
    })
    .from(gamePlayer)
    .innerJoin(game, eq(game.id, gamePlayer.gameId))
    .leftJoin(team, eq(team.id, gamePlayer.teamId))
    .leftJoin(participant, eq(participant.id, gamePlayer.participantId))
    .where(eq(game.competitionId, competitionId))
    .orderBy(game.loggedAt, gamePlayer.id);
  const byGame = new Map<string, LoggedGame>();
  for (const row of rows) {
    const loaded = byGame.get(row.gameId) ?? { players: [] };
    loaded.players.push({
      id: (row.teamId ?? row.participantId)!,
      name: row.teamName ?? row.participantName ?? "Unknown",
      place: row.place,
    });
    byGame.set(row.gameId, loaded);
  }
  return [...byGame.values()];
}

async function insertPlayers(
  tx: DBOrTx,
  gameId: string,
  found: GamesRun,
  input: GameInput,
) {
  await tx.insert(gamePlayer).values(
    input.players.map((p) => ({
      gameId,
      ...sideOf(found.scoring, p.id),
      place: p.place,
      score: p.score,
    })),
  );
}

/**
 * Logs a Game (ADR 0006): under the Competition's row lock, reloads the
 * Game facts with the posted players and checks them again (so a log after
 * Close, the close time or a decided Best of is refused), validates the
 * players, and records who logged it: the email for audit, and the linked
 * Participant (null for a Host or Organizer).
 */
export async function logGame(
  competitionId: string,
  input: GameInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<{ ok: true; gameId: string } | { ok: false; error: string }> {
  return dbOrTx.transaction(async (tx) => {
    const found = await lockedGames(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const facts = await getGameLogFacts(
      competitionId,
      null,
      ctx.actorEmail,
      { playerIds: input.players.map((p) => p.id) },
      tx,
    );
    const refusal = gameLogError(facts.gameLog);
    if (refusal) return refuse(refusal);
    const invalid = await playersError(tx, found, facts, input, ctx);
    if (invalid) return refuse(invalid);
    if (!facts.gameLog.runs && !facts.linked) return refuse(NOT_LINKED);

    const [row] = await tx
      .insert(game)
      .values({
        competitionId,
        loggedByEmail: ctx.actorEmail,
        loggedByParticipantId: facts.gameLog.runs
          ? null
          : facts.linked!.participantId,
      })
      .returning({ id: game.id });
    await insertPlayers(tx, row.id, found, input);
    return { ok: true, gameId: row.id };
  });
}

/**
 * Changes a Game's players (ADR 0006): the logger while logging is open
 * for them and still a player of the edited set, or a Host or Organizer,
 * checked again under the lock. Replaces its player rows and bumps
 * `updated_at`; the logged-at time never changes.
 */
export async function updateGame(
  competitionId: string,
  gameId: string,
  input: GameInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedGames(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const facts = await getGameLogFacts(
      competitionId,
      gameId,
      ctx.actorEmail,
      { playerIds: input.players.map((p) => p.id) },
      tx,
    );
    const refusal = gameChangeError(facts.gameLog);
    if (refusal) return refuse(refusal);
    if (facts.gameLog.game === "missing") return refuse(GAME_MISSING);
    const invalid = await playersError(tx, found, facts, input, ctx);
    if (invalid) return refuse(invalid);

    await tx.delete(gamePlayer).where(eq(gamePlayer.gameId, gameId));
    await insertPlayers(tx, gameId, found, input);
    await tx
      .update(game)
      .set({ updatedAt: sql`now()` })
      .where(eq(game.id, gameId));
    return { ok: true };
  });
}

/** Deletes a Game: the logger while logging is open for them, or a Host or Organizer. */
export async function deleteGame(
  competitionId: string,
  gameId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedGames(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const facts = await getGameLogFacts(
      competitionId,
      gameId,
      ctx.actorEmail,
      { playerIds: [] },
      tx,
    );
    const refusal = gameChangeError(facts.gameLog);
    if (refusal) return refuse(refusal);
    if (facts.gameLog.game === "missing") return refuse(GAME_MISSING);
    await tx
      .delete(game)
      .where(and(eq(game.id, gameId), eq(game.competitionId, competitionId)));
    return { ok: true };
  });
}

/**
 * Saves a Head-to-head or Best score Competition's settings (R3 decision 11). Its Format
 * is fixed: only that type's settings change. A Best of needs a fixed list
 * of exactly two Entrants and takes no enrollment; enrollment is for a
 * fixed list only (`enrollmentUnavailable`). The logged Games must still
 * fit (`loggedGamesSettingsError`). Refused while closed.
 */
export async function setGamesSettings(
  competitionId: string,
  input: GamesSettingsInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedGames(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.finalizedAt) return refuse(GAMES_CLOSED);
    const config = gamesConfigSchema(found.format).safeParse(input.gameConfig);
    if (!config.success) return refuse(GAME_FORMAT_FIXED);

    const h2h = "bestOf" in config.data ? config.data : null;
    const bestOf = h2h?.bestOf ?? null;
    if (bestOf !== null && input.entrantsOpen) {
      return refuse(BEST_OF_NEEDS_FIXED);
    }
    if (input.selfEnroll) {
      const unavailable = enrollmentUnavailable({
        format: found.format,
        entrantsOpen: input.entrantsOpen,
        gameConfig: config.data,
      });
      if (unavailable) return refuse(unavailable);
    }
    const entrantIds = (
      await tx
        .select({
          teamId: entrant.teamId,
          participantId: entrant.participantId,
        })
        .from(entrant)
        .where(eq(entrant.competitionId, competitionId))
    ).flatMap((e) => e.teamId ?? e.participantId ?? []);
    if (bestOf !== null && entrantIds.length !== 2) {
      return refuse(BEST_OF_NEEDS_TWO);
    }
    const misfit = loggedGamesSettingsError({
      wasOpen: found.entrantsOpen,
      entrantsOpen: input.entrantsOpen,
      bestOf,
      drawsAllowed: h2h ? h2h.drawsAllowed : null,
      entrantIds,
      games: await loggedGames(tx, competitionId),
    });
    if (misfit) return refuse(misfit);

    await tx
      .update(competition)
      .set({
        gameConfig: config.data,
        entrantsOpen: input.entrantsOpen,
        loggingClosesAt: input.loggingClosesAt,
        selfEnroll: input.selfEnroll,
        entrantLimit: input.entrantLimit,
        enrollClosesAt: input.enrollClosesAt,
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Closes a Head-to-head or Best score Competition: its leaderboard's places become Placement
 * Points Entries (`pointsFor`, ties sharing a place's points, as when
 * finalizing a Bracket), marked generated and noted "From head-to-head" or "From best score", to the
 * Team or the Participant by scoring; then no Game changes until Reopen.
 */
export async function closeGames(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedGames(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.finalizedAt) return refuse(ALREADY_CLOSED);

    const rows = await getGamesLeaderboard(competitionId, tx);
    const awarded = pointsFor(placingsOf(rows), found);
    await deleteGenerated(tx, competitionId);
    if (awarded.length) {
      await tx.insert(pointsEntry).values(
        awarded.map(({ entrantId, points }) => ({
          warWeekId: ctx.warWeekId,
          competitionId,
          ...sideOf(found.scoring, entrantId),
          points,
          note: generatedNote(found.format),
          enteredByEmail: ctx.actorEmail,
          generatedByBracket: true,
        })),
      );
    }
    await tx
      .update(competition)
      .set({ finalizedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Reopens a closed Head-to-head or Best score Competition: deletes its generated Points
 * Entries and clears `finalized_at`.
 */
export async function reopenGames(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedGames(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    await deleteGenerated(tx, competitionId);
    await tx
      .update(competition)
      .set({ finalizedAt: null, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}
