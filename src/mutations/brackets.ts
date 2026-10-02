import { and, asc, count, eq, inArray, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  day,
  entrant,
  game,
  gamePlayer,
  heat,
  heatEntrant,
  participant,
  pointsEntry,
  squad,
  squadParticipant,
  team,
  warWeek,
} from "@/db/schema";
import { type HeatsConfig, configOf } from "@/lib/bracket/config";
import {
  applyResult,
  finalPlacings,
  generate,
  hasResults,
  isBye,
  isComplete,
  resetByResult,
  validateConfig,
} from "@/lib/bracket/formats";
import { type HeatScheduleValues } from "@/lib/bracket/heat-schedule";
import { pointsFor } from "@/lib/bracket/points";
import {
  shuffleSeedPositions,
  standingsSeedPositions,
} from "@/lib/bracket/seeding";
import {
  type EntrantKind,
  entrantKindError,
  squadError,
} from "@/lib/bracket/squads";
import {
  type Bracket,
  BracketError,
  type BracketFormat,
  HAS_RESULTS_ERROR,
  type HeatResult,
} from "@/lib/bracket/types";
import { isBracketFormat } from "@/lib/bracket/view";
import { gamesConfigOf } from "@/lib/games/config";
import { NOT_GAMES } from "@/lib/games/log-rule";
import { inUseError } from "@/lib/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getBracketEntrants, loadBracket } from "@/queries/brackets";
import { getStandings } from "@/queries/standings";

export const COMPETITION_NOT_FOUND = "That Competition no longer exists.";
export const HEAT_NOT_FOUND = "That Heat no longer exists.";
const DAY_NOT_FOUND = "That Day no longer exists.";
export const BYE_NOT_PLAYED = "A bye isn't played.";
export const NOT_A_BRACKET = "This Competition isn't run as a Bracket.";
export const FINALIZED = "Un-finalize the Bracket before changing it.";
export const SQUAD_NOT_FOUND = "That Squad no longer exists.";
const NOT_A_TEAM_COMPETITION = "Squads are only for team Competitions.";
const SQUADS_SEEDED_AT_RANDOM = "Squads are seeded at random.";
/** Changing a `games` Competition's Format, or making one `games` later. */
export const GAMES_KEEP_FORMAT =
  "A Games Competition keeps its Format; add a new Competition to run it another way.";
/** Changing a `participation` Competition's Format, or making one later. */
export const PARTICIPATION_KEEPS_FORMAT =
  "A Participation Competition keeps its Format; add a new Competition to run it another way.";
/** A closed `games` Competition's Entrants can't change. */
export const GAMES_CLOSED = "Reopen the Competition first.";
const NO_SQUADS_IN_GAMES = "Squads aren't entered in a Games Competition.";
export const BEST_OF_NEEDS_TWO = "A Best of needs exactly 2 Entrants.";
/** The note on every Points Entry a finalized Bracket generates. */
export const FROM_BRACKET_NOTE = "From bracket";

export type BracketCompetition = Pick<
  Competition,
  | "id"
  | "name"
  | "scoring"
  | "format"
  | "bracketConfig"
  | "placementPoints"
  | "finalizedAt"
  | "gameType"
  | "gameConfig"
  | "entrantsOpen"
  | "loggingClosesAt"
  | "selfEnroll"
  | "entrantLimit"
  | "enrollClosesAt"
>;

/** A Competition run as a Bracket (its Format isn't points or games). */
export type BracketRun = BracketCompetition & { format: BracketFormat };

/**
 * Locks a Competition of this War Week for a Bracket write, so two writes
 * to the same Bracket run one after the other. A scoring change
 * (`updateCompetition`) and a Points Entry create take the same row lock.
 */
export async function lockedCompetition(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<BracketCompetition | undefined> {
  const [found] = await tx
    .select({
      id: competition.id,
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      bracketConfig: competition.bracketConfig,
      placementPoints: competition.placementPoints,
      finalizedAt: competition.finalizedAt,
      gameType: competition.gameType,
      gameConfig: competition.gameConfig,
      entrantsOpen: competition.entrantsOpen,
      loggingClosesAt: competition.loggingClosesAt,
      selfEnroll: competition.selfEnroll,
      entrantLimit: competition.entrantLimit,
      enrollClosesAt: competition.enrollClosesAt,
    })
    .from(competition)
    .where(
      and(
        eq(competition.id, competitionId),
        eq(competition.warWeekId, ctx.warWeekId),
      ),
    )
    .for("update");
  return found;
}

/** Why this Competition's Bracket can't change right now, or null. */
export function bracketRefusal(
  found: BracketCompetition | undefined,
  { allowFinalized = false } = {},
): string | null {
  if (!found) return COMPETITION_NOT_FOUND;
  if (!isBracketFormat(found.format)) return NOT_A_BRACKET;
  if (found.finalizedAt && !allowFinalized) return FINALIZED;
  return null;
}

/** The Competition's Bracket, its Format and config already in hand. */
export function bracketOf(tx: DBOrTx, found: BracketRun): Promise<Bracket> {
  return loadBracket(found.id, tx, {
    format: found.format,
    bracketConfig: found.bracketConfig,
  });
}

export function isBracketRun(
  found: BracketCompetition | undefined,
): found is BracketRun {
  return found !== undefined && isBracketFormat(found.format);
}

function sameConfig(a: HeatsConfig | null, b: HeatsConfig | null): boolean {
  return (
    a?.entrantsPerHeat === b?.entrantsPerHeat &&
    a?.advancePerHeat === b?.advancePerHeat
  );
}

export function refuse(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Inserts a freshly generated Bracket's Heats and slots. */
async function insertBracket(
  tx: DBOrTx,
  competitionId: string,
  bracket: Bracket,
) {
  // One statement, so each winner's Heat exists when the row is checked.
  await tx.insert(heat).values(
    bracket.heats.map((h) => ({
      id: h.id,
      competitionId,
      round: h.round,
      position: h.position,
      status: h.status,
      slotCount: h.slots.length,
      winnerToHeatId: h.winnerTo?.heatId ?? null,
      winnerToSlot: h.winnerTo?.slot ?? null,
      // A freshly generated Heat is never timed: a re-draw clears times.
      dayId: h.dayId,
      startTime: h.startTime,
      location: h.location,
    })),
  );
  await insertSlots(tx, bracket.heats);
}

async function insertSlots(tx: DBOrTx, heats: Bracket["heats"]) {
  const rows = heats.flatMap((h) =>
    h.slots.flatMap((slot, i) =>
      slot.entrantId
        ? [
            {
              heatId: h.id,
              entrantId: slot.entrantId,
              slot: i,
              place: slot.place,
              score: slot.score,
              forfeited: slot.forfeited,
            },
          ]
        : [],
    ),
  );
  if (rows.length) await tx.insert(heatEntrant).values(rows);
}

/** Who self-reported a Heat's result; null for a Host or Organizer. */
export type HeatReporter = { email: string; participantId: string };

/**
 * Writes an existing Bracket's Heat statuses and slots back, looking each
 * Heat up by id. Only Generate adds or removes Heats (and sets their slot counts),
 * so a different set of Heat ids here is a programming error.
 *
 * Every changed Heat's reporter columns are rewritten too: `reporter`'s for
 * `reporter.heatId`, null for every other changed Heat. So a save that
 * changes a self-reported result (or refills or empties a later Heat)
 * clears its reporter, and an identical re-save, changing no Heat, keeps it.
 */
async function saveBracket(
  tx: DBOrTx,
  before: Bracket,
  after: Bracket,
  reporter: (HeatReporter & { heatId: string }) | null,
) {
  const beforeById = new Map(before.heats.map((h) => [h.id, h]));
  if (
    after.heats.length !== before.heats.length ||
    new Set(after.heats.map((h) => h.id)).size !== after.heats.length ||
    after.heats.some((h) => !beforeById.has(h.id))
  ) {
    throw new Error("saveBracket: the Bracket's Heat ids changed.");
  }
  const changed = after.heats.filter(
    (h) => JSON.stringify(h) !== JSON.stringify(beforeById.get(h.id)),
  );
  if (changed.length === 0) return;
  for (const h of changed) {
    await tx
      .update(heat)
      .set({
        status: h.status,
        reportedByEmail: reporter?.heatId === h.id ? reporter.email : null,
        reportedByParticipantId:
          reporter?.heatId === h.id ? reporter.participantId : null,
        updatedAt: sql`now()`,
      })
      .where(eq(heat.id, h.id));
  }
  await tx.delete(heatEntrant).where(
    inArray(
      heatEntrant.heatId,
      changed.map((h) => h.id),
    ),
  );
  await insertSlots(tx, changed);
}

/**
 * Sets how a Competition is run, and the heats Format's config. Its Format
 * can't change while it has Entrants or Games, nor either while it's
 * finalized; a `games` or `participation` Competition is that Format from
 * creation, and stays so.
 * Saving a different heats config clears the Heats (keeping the Entrants);
 * once a Heat has a Heat Result, only with `force`. Omitting the config
 * keeps the saved one, unless the Format changes; the default then applies.
 */
export async function setCompetitionFormat(
  competitionId: string,
  values: {
    format: Competition["format"];
    config?: HeatsConfig | null;
    force?: boolean;
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    if (found.format === "games" || values.format === "games") {
      return refuse(GAMES_KEEP_FORMAT);
    }
    if (found.format === "participation" || values.format === "participation") {
      return refuse(PARTICIPATION_KEEPS_FORMAT);
    }
    if (found.finalizedAt) return refuse(FINALIZED);
    const formatChanges = found.format !== values.format;
    if (formatChanges) {
      const [entrants] = await tx
        .select({ count: count() })
        .from(entrant)
        .where(eq(entrant.competitionId, competitionId));
      const refusal = inUseError(
        "Competition",
        [
          [entrants.count, "Entrant", "Entrants"],
          [
            await tx.$count(game, eq(game.competitionId, competitionId)),
            "Game",
            "Games",
          ],
        ],
        "Remove them before changing its Format.",
      );
      if (refusal) return refuse(refusal);
    }
    if (values.format === "points" && found.format !== "points") {
      // Squads are entered only in a Bracket.
      const refusal = inUseError(
        "Competition",
        [
          [
            await tx.$count(squad, eq(squad.competitionId, competitionId)),
            "Squad",
            "Squads",
          ],
        ],
        "Delete them before changing its Format.",
      );
      if (refusal) return refuse(refusal);
    }

    let bracketConfig: HeatsConfig | null = null;
    if (values.format === "heats") {
      bracketConfig =
        values.config ?? (formatChanges ? null : found.bracketConfig);
      // Never save a config Generate would refuse for these Entrants.
      const [entrants] = await tx
        .select({ count: count() })
        .from(entrant)
        .where(eq(entrant.competitionId, competitionId));
      if (entrants.count >= 2) {
        const refusal = validateConfig("heats", bracketConfig, entrants.count);
        if (refusal) return refuse(refusal);
      }
    }
    const configChanges =
      !formatChanges &&
      isBracketRun(found) &&
      values.config != null &&
      !sameConfig(configOf(found), values.config);
    if (configChanges) {
      if (!values.force && hasResults(await bracketOf(tx, found))) {
        return refuse(HAS_RESULTS_ERROR);
      }
      await tx.delete(heat).where(eq(heat.competitionId, competitionId));
    }

    await tx
      .update(competition)
      .set({
        format: values.format,
        bracketConfig,
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Replaces a Bracket's Entrants with these Teams, Participants or Squads of
 * one `kind` (omitted: whichever the Competition's scoring takes), at Seed
 * Positions in the given order. Squads must be this Competition's. It
 * clears the Bracket; once a Heat has a Heat Result, only with `force`.
 *
 * A `games` Competition's fixed Entrant list takes the same Teams or
 * Participants (never Squads), in the order added; it has no Heats to
 * clear. While Best of is on it takes exactly 2, and an Entrant who has
 * logged Games can't be removed until they're deleted.
 *
 * `format` says which the caller sets: a Bracket's Entrants refuse a
 * `games` Competition, a `games` Competition's refuse any other Format.
 */
export async function replaceEntrants(
  competitionId: string,
  {
    targetIds,
    force,
    kind: givenKind,
    format,
  }: {
    targetIds: string[];
    force?: boolean;
    kind?: EntrantKind;
    format?: "bracket" | "games";
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const isGames = found?.format === "games";
    if (found && format === "games" && !isGames) return refuse(NOT_GAMES);
    if (found && format === "bracket" && isGames) return refuse(NOT_A_BRACKET);
    if (isGames) {
      if (found.finalizedAt) return refuse(GAMES_CLOSED);
      if (givenKind === "squad") return refuse(NO_SQUADS_IN_GAMES);
    } else {
      const refusal = bracketRefusal(found);
      if (refusal || !isBracketRun(found)) {
        return refuse(refusal ?? NOT_A_BRACKET);
      }
    }
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    const isTeam = found.scoring === "team";
    const kind = givenKind ?? (isTeam ? "team" : "participant");
    const kindRefusal = entrantKindError(found.scoring, kind);
    if (kindRefusal) return refuse(kindRefusal);
    if (new Set(targetIds).size !== targetIds.length) {
      return refuse(
        kind === "squad"
          ? "Enter each Squad only once."
          : "Enter each Team or Participant only once.",
      );
    }

    if (kind === "squad") {
      const valid = targetIds.length
        ? await tx.$count(
            squad,
            and(
              inArray(squad.id, targetIds),
              eq(squad.competitionId, competitionId),
            ),
          )
        : 0;
      if (valid !== targetIds.length) {
        return refuse("Enter Squads of this Competition.");
      }
    } else {
      const table = kind === "team" ? team : participant;
      const valid = targetIds.length
        ? await tx.$count(
            table,
            and(
              inArray(table.id, targetIds),
              eq(table.warWeekId, ctx.warWeekId),
            ),
          )
        : 0;
      if (valid !== targetIds.length) {
        return refuse(
          isTeam
            ? `"${found.name}" is a team Competition, so its Entrants must be Teams of this War Week.`
            : `"${found.name}" is an individual Competition, so its Entrants must be Participants of this War Week.`,
        );
      }
    }
    if (isGames) {
      const config = found.gameType
        ? gamesConfigOf({
            gameType: found.gameType,
            gameConfig: found.gameConfig,
          })
        : null;
      if (config && "bestOf" in config && config.bestOf !== null) {
        if (targetIds.length !== 2) return refuse(BEST_OF_NEEDS_TWO);
      }
      const played = await removedPlayerWithGames(tx, competitionId, targetIds);
      if (played)
        return refuse(`${played} has logged Games. Delete them first.`);
    } else {
      if (
        !force &&
        isBracketRun(found) &&
        hasResults(await bracketOf(tx, found))
      ) {
        return refuse(HAS_RESULTS_ERROR);
      }
      await tx.delete(heat).where(eq(heat.competitionId, competitionId));
    }

    await tx.delete(entrant).where(eq(entrant.competitionId, competitionId));
    if (targetIds.length) {
      await tx.insert(entrant).values(
        targetIds.map((id, i) => ({
          competitionId,
          seedPosition: i + 1,
          teamId: kind === "team" ? id : null,
          participantId: kind === "participant" ? id : null,
          squadId: kind === "squad" ? id : null,
        })),
      );
    }
    return { ok: true };
  });
}

/**
 * The name of a current Entrant of this `games` Competition, left out of
 * `keptIds`, who is a player in one of its Games; null when there's none.
 * Games reference Teams and Participants, never Entrant rows.
 */
async function removedPlayerWithGames(
  tx: DBOrTx,
  competitionId: string,
  keptIds: string[],
): Promise<string | null> {
  const kept = new Set(keptIds);
  const removed = (
    await tx
      .select({ teamId: entrant.teamId, participantId: entrant.participantId })
      .from(entrant)
      .where(eq(entrant.competitionId, competitionId))
  )
    .map((row) => row.teamId ?? row.participantId)
    .filter((id): id is string => id !== null && !kept.has(id));
  if (removed.length === 0) return null;
  const [played] = await tx
    .select({ teamName: team.name, participantName: participant.displayName })
    .from(gamePlayer)
    .innerJoin(game, eq(game.id, gamePlayer.gameId))
    .leftJoin(team, eq(team.id, gamePlayer.teamId))
    .leftJoin(participant, eq(participant.id, gamePlayer.participantId))
    .where(
      and(
        eq(game.competitionId, competitionId),
        or(
          inArray(gamePlayer.teamId, removed),
          inArray(gamePlayer.participantId, removed),
        ),
      ),
    )
    .orderBy(asc(team.name), asc(participant.displayName))
    .limit(1);
  return played ? (played.teamName ?? played.participantName) : null;
}

/**
 * Draws the Seed Positions — randomly (by `rng`), or by the current
 * Standings — and builds the Bracket, byes included. Once a Heat has a Heat
 * Result, regenerating needs `force`, which clears every result.
 */
export async function generateBracket(
  competitionId: string,
  options: {
    rng?: () => number;
    force?: boolean;
    /** "random" (default) or "standings"; see `standingsSeedPositions`. */
    seeding?: "random" | "standings";
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found);
    if (refusal || !isBracketRun(found)) {
      return refuse(refusal ?? NOT_A_BRACKET);
    }
    const entrants = await getBracketEntrants(competitionId, tx);
    if (entrants.length < 2) return refuse("Add at least 2 Entrants first.");
    if (
      options.seeding === "standings" &&
      entrants.some((e) => e.squadId !== null)
    ) {
      return refuse(SQUADS_SEEDED_AT_RANDOM);
    }
    const config = configOf(found);
    const configRefusal = validateConfig(found.format, config, entrants.length);
    if (configRefusal) return refuse(configRefusal);
    if (!options.force && hasResults(await bracketOf(tx, found))) {
      return refuse(HAS_RESULTS_ERROR);
    }

    const rng = options.rng ?? Math.random;
    let seeded: { entrantId: string; seedPosition: number }[];
    if (options.seeding === "standings") {
      const [warWeekRow] = await tx
        .select({ mode: warWeek.mode })
        .from(warWeek)
        .where(eq(warWeek.id, ctx.warWeekId))
        .limit(1);
      const standings = await getStandings(
        { id: ctx.warWeekId, mode: warWeekRow!.mode },
        tx,
      );
      seeded = standingsSeedPositions(entrants, standings, found.scoring, rng);
    } else {
      seeded = shuffleSeedPositions(
        entrants.map((e) => e.id),
        rng,
      );
    }
    // Seed Positions are unique per Competition: move them aside first.
    await tx
      .update(entrant)
      .set({ seedPosition: sql`-${entrant.seedPosition}` })
      .where(eq(entrant.competitionId, competitionId));
    for (const { entrantId, seedPosition } of seeded) {
      await tx
        .update(entrant)
        .set({ seedPosition })
        .where(eq(entrant.id, entrantId));
    }

    const bracket = generate(
      found.format,
      config,
      seeded.map(({ entrantId, seedPosition }) => ({
        id: entrantId,
        seedPosition,
        label: "",
      })),
      () => randomUUID(),
    );
    await tx.delete(heat).where(eq(heat.competitionId, competitionId));
    await insertBracket(tx, competitionId, bracket);
    return { ok: true };
  });
}

/**
 * Records a Heat Result and advances who goes on, per the Format. Changing
 * who advances from a decided Heat resets the later Heats that followed
 * from it; the ids of those that had a Heat Result are returned. A
 * score-only edit resets nothing.
 */
export async function recordHeatResult(
  competitionId: string,
  heatId: string,
  result: HeatResult,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<
  { ok: true; resetHeatIds: string[] } | { ok: false; error: string }
> {
  return dbOrTx.transaction(async (tx) => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    return writeHeatResult(tx, found, heatId, result, null);
  });
}

/**
 * The one Heat Result write, shared by a Host's `recordHeatResult` and a
 * Participant's self-report, run with the Competition's row lock already
 * held: refuses a Competition that can't change, finds the Heat in its own
 * Bracket, resets and applies the result per the Format, and saves it with
 * its reporter (null for a Host or Organizer).
 */
export async function writeHeatResult(
  tx: DBOrTx,
  found: BracketCompetition | undefined,
  heatId: string,
  result: HeatResult,
  reporter: HeatReporter | null,
): Promise<
  { ok: true; resetHeatIds: string[] } | { ok: false; error: string }
> {
  const refusal = bracketRefusal(found);
  if (refusal || !isBracketRun(found)) {
    return refuse(refusal ?? NOT_A_BRACKET);
  }
  const bracket = await bracketOf(tx, found);
  const target = bracket.heats.find((h) => h.id === heatId);
  if (!target) return refuse(HEAT_NOT_FOUND);

  let next: Bracket;
  let resetHeatIds: string[];
  try {
    resetHeatIds = resetByResult(bracket, heatId, result);
    next = applyResult(bracket, heatId, result);
  } catch (error) {
    if (error instanceof BracketError) return refuse(error.message);
    throw error;
  }
  await saveBracket(tx, bracket, next, reporter && { ...reporter, heatId });
  return { ok: true as const, resetHeatIds };
}

/**
 * Sets, or clears, one Heat's Day, start time and location, so "Your next
 * Heat" and Now/Next can show when and where it plays. A decided Heat may
 * still be edited (it never shows in Now/Next); a bye is never played, so
 * it's refused; a Day deleted between the check and the update fails the
 * foreign key and surfaces as the generic refusal (decision 2).
 */
export async function setHeatSchedule(
  competitionId: string,
  heatId: string,
  values: HeatScheduleValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found);
    if (refusal || !isBracketRun(found)) {
      return refuse(refusal ?? NOT_A_BRACKET);
    }
    const bracket = await bracketOf(tx, found);
    const target = bracket.heats.find((h) => h.id === heatId);
    if (!target) return refuse(HEAT_NOT_FOUND);
    if (isBye(bracket, target)) return refuse(BYE_NOT_PLAYED);

    if (values.dayId !== null) {
      const [foundDay] = await tx
        .select({ id: day.id })
        .from(day)
        .where(and(eq(day.id, values.dayId), eq(day.warWeekId, ctx.warWeekId)))
        .limit(1);
      if (!foundDay) return refuse(DAY_NOT_FOUND);
    }

    await tx
      .update(heat)
      .set({
        dayId: values.dayId,
        startTime: values.startTime,
        location: values.location,
        updatedAt: sql`now()`,
      })
      .where(eq(heat.id, heatId));
    return { ok: true };
  });
}

/**
 * Finalizes a finished Bracket: replaces its generated Points Entries with
 * new ones from the final placings and Placement Points (hand-entered
 * Points Entries are untouched), and marks it finalized.
 */
export async function finalizeBracket(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found, { allowFinalized: true });
    if (refusal || !isBracketRun(found)) {
      return refuse(refusal ?? NOT_A_BRACKET);
    }
    const bracket = await bracketOf(tx, found);
    if (!isComplete(bracket)) {
      return refuse("Finish every Heat before finalizing.");
    }

    const entrants = await getBracketEntrants(competitionId, tx);
    const byId = new Map(entrants.map((e) => [e.id, e]));
    const awarded = pointsFor(finalPlacings(bracket, entrants), found);

    await deleteGenerated(tx, competitionId);
    if (awarded.length) {
      await tx.insert(pointsEntry).values(
        awarded.map(({ entrantId, points }) => ({
          competitionId,
          // A Team's, or a Squad's Team's; null for a Participant.
          teamId: byId.get(entrantId)!.pointsTeamId,
          participantId: byId.get(entrantId)!.participantId,
          points,
          note: FROM_BRACKET_NOTE,
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
 * Deletes a Competition's generated Points Entries: a Bracket's on
 * un-finalize or re-finalize, a `games` Competition's on Reopen.
 */
export function deleteGenerated(tx: DBOrTx, competitionId: string) {
  return tx
    .delete(pointsEntry)
    .where(
      and(
        eq(pointsEntry.competitionId, competitionId),
        eq(pointsEntry.generatedByBracket, true),
      ),
    );
}

/** Deletes a Bracket's generated Points Entries and un-finalizes it. */
export async function unfinalizeBracket(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found, { allowFinalized: true });
    if (refusal) return refuse(refusal);
    await deleteGenerated(tx, competitionId);
    await tx
      .update(competition)
      .set({ finalizedAt: null, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/** A Squad's name, Team and Participants, as the Squad form posts them. */
export type SquadValues = {
  name: string;
  teamId: string | null;
  participantIds: string[];
};

/**
 * The Competition, locked, if Squads of it may be written: refuses one that
 * isn't a Bracket, is finalized or isn't team-scoring.
 */
async function lockedForSquads(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await lockedCompetition(tx, competitionId, ctx);
  const refusal = bracketRefusal(found);
  if (refusal) return refuse(refusal);
  if (found!.scoring !== "team") return refuse(NOT_A_TEAM_COMPETITION);
  return { ok: true };
}

/** Whether this Squad is one of this Competition's. */
async function squadOf(
  tx: DBOrTx,
  competitionId: string,
  squadId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: squad.id })
    .from(squad)
    .where(and(eq(squad.id, squadId), eq(squad.competitionId, competitionId)));
  return rows.length > 0;
}

/**
 * Why these Squad values can't be saved in this Competition, or null, with
 * the Competition's row lock held (so no other Squad write interleaves).
 * The chosen Participants are locked `for share`, so a Team change on one
 * (`updateParticipant`) waits for this write.
 */
async function squadRefusal(
  tx: DBOrTx,
  competitionId: string,
  values: SquadValues,
  ctx: MutationContext,
  exceptSquadId?: string,
): Promise<MutationResult | null> {
  const participantIds = [...new Set(values.participantIds)];
  const participants = participantIds.length
    ? await tx
        .select({
          id: participant.id,
          displayName: participant.displayName,
          teamId: participant.teamId,
        })
        .from(participant)
        .where(
          and(
            inArray(participant.id, participantIds),
            eq(participant.warWeekId, ctx.warWeekId),
          ),
        )
        .for("share")
    : [];
  if (participants.length !== participantIds.length) {
    const error = "Choose Participants of this War Week.";
    return { ok: false, error, fieldErrors: { participantIds: error } };
  }

  const [warWeekRow] = await tx
    .select({ teamLabel: warWeek.teamLabel })
    .from(warWeek)
    .where(eq(warWeek.id, ctx.warWeekId));
  // A Team of another War Week is no Team here.
  const teamOk =
    values.teamId !== null &&
    (await tx.$count(
      team,
      and(eq(team.id, values.teamId), eq(team.warWeekId, ctx.warWeekId)),
    )) > 0;
  const taken = participantIds.length
    ? await tx
        .select({
          participantId: squadParticipant.participantId,
          name: squad.name,
        })
        .from(squadParticipant)
        .innerJoin(squad, eq(squad.id, squadParticipant.squadId))
        .where(
          and(
            eq(squad.competitionId, competitionId),
            inArray(squadParticipant.participantId, participantIds),
            exceptSquadId ? ne(squad.id, exceptSquadId) : undefined,
          ),
        )
    : [];
  const refusal = squadError({
    name: values.name,
    teamId: teamOk ? values.teamId : null,
    participants,
    taken: Object.fromEntries(taken.map((t) => [t.participantId, t.name])),
    teamLabel: warWeekRow?.teamLabel,
  });
  if (refusal) return { ok: false, ...refusal };

  const name = values.name.trim();
  const nameTaken = await tx.$count(
    squad,
    and(
      eq(squad.competitionId, competitionId),
      eq(squad.name, name),
      exceptSquadId ? ne(squad.id, exceptSquadId) : undefined,
    ),
  );
  if (nameTaken > 0) {
    const error = `A Squad named "${name}" already exists.`;
    return { ok: false, error, fieldErrors: { name: error } };
  }
  return null;
}

async function insertSquadParticipants(
  tx: DBOrTx,
  squadId: string,
  participantIds: string[],
) {
  await tx.insert(squadParticipant).values(
    [...new Set(participantIds)].map((participantId) => ({
      squadId,
      participantId,
    })),
  );
}

/**
 * Adds a Squad to a team-scoring Bracket: a name unique in the Competition,
 * a Team of this War Week, and 1–16 of that Team's Participants, none
 * already in another Squad of the Competition.
 */
export async function createSquad(
  competitionId: string,
  values: SquadValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const locked = await lockedForSquads(tx, competitionId, ctx);
    if (!locked.ok) return locked;
    const refusal = await squadRefusal(tx, competitionId, values, ctx);
    if (refusal) return refusal;

    const [created] = await tx
      .insert(squad)
      .values({
        competitionId,
        teamId: values.teamId!,
        name: values.name.trim(),
      })
      .returning({ id: squad.id });
    await insertSquadParticipants(tx, created.id, values.participantIds);
    return { ok: true };
  });
}

/**
 * Edits a Squad of this Competition (never another's: a Squad id of another
 * Competition is "no longer exists"). An entered Squad may be renamed or
 * have its Participants changed; its Team is fixed while it's an Entrant
 * (decision 4), so a roster change can't move its points. Its Entrant and
 * Heats are untouched.
 */
export async function updateSquad(
  competitionId: string,
  squadId: string,
  values: SquadValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const locked = await lockedForSquads(tx, competitionId, ctx);
    if (!locked.ok) return locked;
    const [current] = await tx
      .select({ teamId: squad.teamId })
      .from(squad)
      .where(
        and(eq(squad.id, squadId), eq(squad.competitionId, competitionId)),
      );
    if (!current) return refuse(SQUAD_NOT_FOUND);
    if (
      values.teamId !== current.teamId &&
      (await tx.$count(entrant, eq(entrant.squadId, squadId))) > 0
    ) {
      const [warWeekRow] = await tx
        .select({ teamLabel: warWeek.teamLabel })
        .from(warWeek)
        .where(eq(warWeek.id, ctx.warWeekId));
      const teamLabel = warWeekRow?.teamLabel ?? "Team";
      const error = `This Squad is an Entrant. Remove it from the Entrants before changing its ${teamLabel}.`;
      return { ok: false, error, fieldErrors: { teamId: error } };
    }
    const refusal = await squadRefusal(tx, competitionId, values, ctx, squadId);
    if (refusal) return refusal;

    await tx
      .update(squad)
      .set({
        name: values.name.trim(),
        teamId: values.teamId!,
        updatedAt: sql`now()`,
      })
      .where(
        and(eq(squad.id, squadId), eq(squad.competitionId, competitionId)),
      );
    await tx
      .delete(squadParticipant)
      .where(eq(squadParticipant.squadId, squadId));
    await insertSquadParticipants(tx, squadId, values.participantIds);
    return { ok: true };
  });
}

/** Deletes a Squad of this Competition, refusing one that is an Entrant. */
export async function deleteSquad(
  competitionId: string,
  squadId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const locked = await lockedForSquads(tx, competitionId, ctx);
    if (!locked.ok) return locked;
    if (!(await squadOf(tx, competitionId, squadId))) {
      return refuse(SQUAD_NOT_FOUND);
    }
    if ((await tx.$count(entrant, eq(entrant.squadId, squadId))) > 0) {
      return refuse(
        "This Squad is an Entrant. Remove it from the Entrants first.",
      );
    }
    await tx
      .delete(squad)
      .where(
        and(eq(squad.id, squadId), eq(squad.competitionId, competitionId)),
      );
    return { ok: true };
  });
}
