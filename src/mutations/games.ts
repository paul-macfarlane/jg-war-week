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
import type { GameType } from "@/lib/enums";
import { gamesConfigSchema } from "@/lib/games/config";
import type { GameInput, GamesSettingsInput } from "@/lib/games/input";
import { placingsOf } from "@/lib/games/leaderboard";
import {
  GAME_MISSING,
  NOT_AN_ENTRANT,
  NOT_LINKED,
  gameChangeError,
  gameLogError,
} from "@/lib/games/log-rule";
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
import { BEST_OF_NO_ENROLL, OPEN_NO_ENROLL } from "@/mutations/enrollment";
import type { MutationContext, MutationResult } from "@/mutations/types";
import {
  type GameLogFacts,
  NOT_GAMES,
  getGameLogFacts,
  getGamesLeaderboard,
  sideOf,
} from "@/queries/games";

export const ALREADY_CLOSED = "This Competition is already closed.";
export const REPEATED_PLAYER = "Choose each player only once.";
export const GAME_TYPE_FIXED =
  "A Games Competition keeps its Game Type; add a new Competition to play another.";
export const BEST_OF_NEEDS_FIXED = "A Best of needs a fixed Entrant list.";
export const BEST_OF_BETWEEN_ENTRANTS =
  "A Best of is played between its 2 Entrants.";

const PLAYER_COUNT: Record<GameType, [(n: number) => boolean, string]> = {
  "head-to-head": [
    (n) => n === 2,
    "A head-to-head Game has exactly 2 players.",
  ],
  "best-score": [(n) => n === 1, "A best-score Game has exactly 1 player."],
  ranked: [(n) => n >= 2, "A ranked Game has at least 2 players."],
};

type GamesRun = BracketCompetition & { gameType: GameType };

/** Why this Competition can't take a Games write, or null. */
function gamesRefusal(found: BracketCompetition | undefined): string | null {
  if (!found) return COMPETITION_NOT_FOUND;
  if (found.format !== "games" || !found.gameType) return NOT_GAMES;
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
 * Why the posted players can't be a Game here, or null (R3 decision 10):
 * distinct; as many as the Game Type takes; Teams (team scoring) or
 * Participants (individual) of this War Week; on a fixed list, Entrants;
 * in a Best of, the two Entrants. Checked for everyone, Hosts included.
 */
async function playersError(
  tx: DBOrTx,
  found: GamesRun,
  facts: GameLogFacts,
  input: GameInput,
  ctx: MutationContext,
): Promise<string | null> {
  const ids = input.players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) return REPEATED_PLAYER;
  const [countOk, countError] = PLAYER_COUNT[found.gameType];
  if (!countOk(ids.length)) return countError;

  const isTeam = found.scoring === "team";
  const table = isTeam ? team : participant;
  const valid = await tx.$count(
    table,
    and(inArray(table.id, ids), eq(table.warWeekId, ctx.warWeekId)),
  );
  if (valid !== ids.length) {
    return isTeam
      ? "Every player must be a Team of this War Week."
      : "Every player must be a Participant of this War Week.";
  }

  const { entrants } = facts.gameLog;
  const config = facts.competition?.config;
  if (config && "bestOf" in config && config.bestOf !== null) {
    if (found.entrantsOpen || entrants.length !== 2) {
      return BEST_OF_BETWEEN_ENTRANTS;
    }
  }
  if (!found.entrantsOpen) {
    const entered = new Set(
      entrants.map((e) => (isTeam ? e.teamId : e.participantId)),
    );
    if (!ids.every((id) => entered.has(id))) return NOT_AN_ENTRANT;
  }
  return null;
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
 * Saves a `games` Competition's settings (R3 decision 11). Its Game Type
 * is fixed: only that type's settings change. A Best of needs a fixed list
 * of exactly two Entrants and takes no enrollment; enrollment is for a
 * fixed list only. Refused while closed.
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
    const config = gamesConfigSchema(found.gameType).safeParse(
      input.gameConfig,
    );
    if (!config.success) return refuse(GAME_TYPE_FIXED);

    const bestOf = "bestOf" in config.data && config.data.bestOf !== null;
    if (bestOf) {
      if (input.entrantsOpen) return refuse(BEST_OF_NEEDS_FIXED);
      if (input.selfEnroll) return refuse(BEST_OF_NO_ENROLL);
      const entrants = await tx.$count(
        entrant,
        eq(entrant.competitionId, competitionId),
      );
      if (entrants !== 2) return refuse(BEST_OF_NEEDS_TWO);
    }
    if (input.entrantsOpen && input.selfEnroll) return refuse(OPEN_NO_ENROLL);

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
 * Closes a `games` Competition: its leaderboard's places become Placement
 * Points Entries (`pointsFor`, ties sharing a place's points, as when
 * finalizing a Bracket), marked generated and noted "From games", to the
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
          competitionId,
          ...sideOf(found.scoring, entrantId),
          points,
          note: generatedNote("games"),
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
 * Reopens a closed `games` Competition: deletes its generated Points
 * Entries (hand-entered ones are untouched) and clears `finalized_at`.
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
