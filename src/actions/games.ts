"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize, authorizeGameWrite } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { parseGameInput } from "@/lib/games/input";
import * as mutations from "@/mutations/games";
import type { MutationContext, MutationResult } from "@/mutations/types";

export type LogGameResult =
  { ok: true; gameId: string } | { ok: false; error: string };

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

/**
 * Runs a Game write (ADR 0006): authorizes the actor with the Game facts
 * and the posted input (its players read by the Format) first, so a refusal wins over malformed input,
 * then parses the input by the Competition's Format. The mutation
 * checks the facts again under the Competition's lock.
 */
async function gameWrite<R extends { ok: boolean }>(
  action: "games.log" | "games.edit" | "games.delete",
  competitionId: string,
  gameId: string | null,
  input: unknown,
  write: (
    parsed: Parameters<typeof mutations.logGame>[1],
    ctx: MutationContext,
  ) => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  return guarded(async () => {
    const authorized = await authorizeGameWrite(
      action,
      competitionId,
      gameId,
      action === "games.delete" ? null : input,
    );
    if (!authorized.ok) return authorized;
    let players: Parameters<typeof mutations.logGame>[1] = { players: [] };
    if (action !== "games.delete") {
      const { gameFormat, config } = authorized.competition;
      const parsed = parseGameInput(gameFormat, config, asRecord(input));
      if (!parsed.ok) return parsed;
      players = parsed.value;
    }
    const result = await write(players, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Logs a Game, as a player in it or a Host or Organizer. */
export async function logGame(
  competitionId: string,
  input: unknown,
): Promise<LogGameResult> {
  return gameWrite("games.log", competitionId, null, input, (parsed, ctx) =>
    mutations.logGame(competitionId, parsed, ctx),
  );
}

/** Changes a Game's players, as its logger or a Host or Organizer. */
export async function updateGame(
  competitionId: string,
  gameId: string,
  input: unknown,
): Promise<MutationResult> {
  return gameWrite("games.edit", competitionId, gameId, input, (parsed, ctx) =>
    mutations.updateGame(competitionId, gameId, parsed, ctx),
  );
}

/** Deletes a Game, as its logger or a Host or Organizer. */
export async function deleteGame(
  competitionId: string,
  gameId: string,
): Promise<MutationResult> {
  return gameWrite("games.delete", competitionId, gameId, null, (_, ctx) =>
    mutations.deleteGame(competitionId, gameId, ctx),
  );
}

/**
 * Runs a Host or Organizer write on a Head-to-head or Best score Competition, in its own War
 * Week (loaded from the row), then revalidates the War Week's pages.
 * `write` parses its input, after authorize.
 */
async function hostWrite(
  action: WarWeekAction,
  competitionId: string,
  write: (ctx: MutationContext) => Promise<MutationResult>,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorize(action, "competition", competitionId);
    if (!authorized.ok) return authorized;
    const result = await write(authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function closeGames(
  competitionId: string,
): Promise<MutationResult> {
  return hostWrite("games.close", competitionId, (ctx) =>
    mutations.closeGames(competitionId, ctx),
  );
}

/** Reopens a closed Head-to-head or Best score Competition, withdrawing its generated Points Entries. */
export async function reopenGames(
  competitionId: string,
): Promise<MutationResult> {
  return hostWrite("games.reopen", competitionId, (ctx) =>
    mutations.reopenGames(competitionId, ctx),
  );
}
