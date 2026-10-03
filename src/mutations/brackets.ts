import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
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
import {
  type BracketConfig,
  configOf,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import {
  applyResult,
  finalPlacings,
  generate,
  hasResults,
  isComplete,
  resetByResult,
  validateConfig,
} from "@/lib/bracket/formats";
import { pointsFor } from "@/lib/bracket/points";
import { shuffleSeedPositions } from "@/lib/bracket/seeding";
import {
  type EntrantKind,
  entrantKindError,
  squadError,
} from "@/lib/bracket/squads";
import {
  type Bracket,
  BracketError,
  type BracketFormat,
  type HeatResult,
} from "@/lib/bracket/types";
import { isBracketFormat } from "@/lib/bracket/view";
import {
  LOCKED_BY_HEAT_RESULT,
  settingLockReason,
} from "@/lib/competition-locks";
import { isGameFormat } from "@/lib/enums";
import { formatDefaults } from "@/lib/format-defaults";
import { gamesConfigOf } from "@/lib/games/config";
import { NOT_GAMES } from "@/lib/games/log-rule";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getBracketEntrants, loadBracket } from "@/queries/brackets";
import { getCompetitionLockFacts } from "@/queries/competition-locks";

export const COMPETITION_NOT_FOUND = "That Competition no longer exists.";
export const HEAT_NOT_FOUND = "That Heat no longer exists.";
export const NOT_A_BRACKET = "This Competition isn't run as a Bracket.";
export const FINALIZED = "Un-finalize the Bracket before changing it.";
export const SQUAD_NOT_FOUND = "That Squad no longer exists.";
export const ONLY_A_BRACKET_TAKES_HEATS = "Only a Bracket takes Heat settings.";
const NOT_A_TEAM_COMPETITION = "Squads are only for team Competitions.";
/** A closed Head-to-head or Best score Competition's Entrants can't change. */
export const GAMES_CLOSED = "Reopen the Competition first.";
const NO_SQUADS_IN_GAMES =
  "Squads aren't entered in a Head-to-head or Best score Competition.";
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
  | "gameConfig"
  | "entrantsOpen"
  | "loggingClosesAt"
  | "selfEnroll"
  | "entrantLimit"
  | "enrollClosesAt"
>;

/** A Competition run as a Bracket (its Format isn't placement, Head-to-head, Best score or participation). */
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

function sameConfig(a: BracketConfig, b: BracketConfig): boolean {
  return (
    a.entrantsPerHeat === b.entrantsPerHeat &&
    a.advancePerHeat === b.advancePerHeat &&
    a.thirdPlaceGame === b.thirdPlaceGame
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
  // One statement, so each winner's (and loser's) Heat exists when the row
  // is checked.
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
      loserToHeatId: h.loserTo?.heatId ?? null,
      loserToSlot: h.loserTo?.slot ?? null,
      thirdPlace: h.thirdPlace,
      // A freshly generated Heat is never played: a re-draw clears results.
      recordedAt: null,
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
 *
 * `recordedHeatId` is the Heat whose Result is being saved: its `recorded_at`
 * becomes now, even when the save changes nothing else. Any other changed Heat
 * that is no longer played (a later Heat the result reset) loses its
 * `recorded_at`; a changed Heat still played keeps it.
 */
async function saveBracket(
  tx: DBOrTx,
  before: Bracket,
  after: Bracket,
  reporter: (HeatReporter & { heatId: string }) | null,
  recordedHeatId: string,
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
  if (!changed.some((h) => h.id === recordedHeatId)) {
    // An identical re-save still records when the Result was saved.
    await tx
      .update(heat)
      .set({ recordedAt: sql`now()` })
      .where(and(eq(heat.id, recordedHeatId), eq(heat.status, "played")));
  }
  if (changed.length === 0) return;
  for (const h of changed) {
    await tx
      .update(heat)
      .set({
        status: h.status,
        ...(h.status !== "played"
          ? { recordedAt: null }
          : h.id === recordedHeatId
            ? { recordedAt: sql`now()` }
            : {}),
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
 * Sets how a Competition is run (its Format), or a Bracket's config.
 *
 * A Format change goes from any Format to any other while the Competition
 * has no result (`settingLockReason("format")`), and applies what
 * `createCompetition` gives a new Competition of that Format: a Bracket's
 * config (`config`, else the default), a Head-to-head or Best score
 * Competition's default settings and open Entrants, a Participation
 * Competition's points columns. The old Format's settings go: the Score
 * direction back to none, Self-report, self-enroll, close times and Self
 * check-in off, a Bracket's Squads deleted. Placement Points are kept
 * (the first 4 for a Bracket; none for an individual Participation
 * Competition, which takes points per Participant instead).
 *
 * A Bracket's config locks once a Heat has a result
 * (`settingLockReason("bracketConfig")`); before that a different config
 * clears the drawn Heats, keeping the Entrants. Omitting the config keeps
 * the saved one.
 */
export async function setCompetitionFormat(
  competitionId: string,
  values: {
    format: Competition["format"];
    config?: BracketConfig;
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    if (values.config != null && values.format !== "bracket") {
      return refuse(ONLY_A_BRACKET_TAKES_HEATS);
    }
    const facts = await getCompetitionLockFacts(found, tx);

    if (found.format !== values.format) {
      const locked = settingLockReason("format", facts);
      if (locked) return refuse(locked);
      return changeFormat(tx, found, values.format, values.config);
    }

    if (!isBracketRun(found) || values.config == null) return { ok: true };
    if (sameConfig(configOf(found), values.config)) return { ok: true };
    const locked = settingLockReason("bracketConfig", facts);
    if (locked) return refuse(locked);
    // Never save a config Generate would refuse for these Entrants.
    const entrants = await tx.$count(
      entrant,
      eq(entrant.competitionId, competitionId),
    );
    // A 3rd place game needs 2 / 1 and 4 Entrants, entered or not yet.
    const thirdPlace = thirdPlaceRefusal(values.config, entrants);
    if (thirdPlace) return refuse(thirdPlace);
    if (entrants >= 2) {
      const refusal = validateConfig(values.config, entrants);
      if (refusal) return refuse(refusal);
    }
    // No Heat has a result: the drawn Heats go, the Entrants stay.
    await tx.delete(heat).where(eq(heat.competitionId, competitionId));
    await tx
      .update(competition)
      .set({ bracketConfig: values.config, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Moves a Competition with no result to `format`, with that Format's create
 * defaults (`setCompetitionFormat`). The caller holds the row lock and has
 * checked the lock.
 */
async function changeFormat(
  tx: DBOrTx,
  found: BracketCompetition,
  format: Competition["format"],
  config: BracketConfig | undefined,
): Promise<MutationResult> {
  const defaults = formatDefaults(format, found, config);
  if (defaults.bracketConfig) {
    // No Entrants yet (they're a result).
    const thirdPlace = thirdPlaceRefusal(defaults.bracketConfig, 0);
    if (thirdPlace) return refuse(thirdPlace);
  }
  if (found.format === "bracket") {
    // Squads are entered only in a Bracket; none is an Entrant yet.
    await tx.delete(squad).where(eq(squad.competitionId, found.id));
  }
  await tx
    .update(competition)
    .set({
      format,
      ...defaults,
      scoreDirection: "none",
      selfReport: false,
      selfEnroll: false,
      entrantLimit: null,
      enrollClosesAt: null,
      loggingClosesAt: null,
      selfCheckIn: false,
      checkInClosesAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(competition.id, found.id));
  return { ok: true };
}

/**
 * Replaces a Bracket's Entrants with these Teams, Participants or Squads of
 * one `kind` (omitted: whichever the Competition's scoring takes), at Seed
 * Positions in the given order. Squads must be this Competition's. It
 * clears the drawn Bracket; once a Heat has a Heat Result the Entrants are
 * locked (`LOCKED_BY_HEAT_RESULT`).
 *
 * A Head-to-head or Best score Competition's fixed Entrant list takes the same Teams or
 * Participants (never Squads), in the order added; it has no Heats to
 * clear. While Best of is on it takes exactly 2, and an Entrant who has
 * logged Games can't be removed until they're deleted.
 *
 * `format` says which the caller sets: a Bracket's Entrants refuse a
 * Head-to-head or Best score Competition, theirs refuse any other Format.
 */
export async function replaceEntrants(
  competitionId: string,
  {
    targetIds,
    kind: givenKind,
    format,
  }: {
    targetIds: string[];
    kind?: EntrantKind;
    format?: "bracket" | "games";
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const isGames = found !== undefined && isGameFormat(found.format);
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
      const config = isGameFormat(found.format)
        ? gamesConfigOf({
            format: found.format,
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
      if (isBracketRun(found) && hasResults(await bracketOf(tx, found))) {
        return refuse(LOCKED_BY_HEAT_RESULT);
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
 * The name of a current Entrant of this Head-to-head or Best score Competition, left out of
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
 * Draws the Seed Positions at random (by `rng`) and builds the Bracket,
 * byes included. Once a Heat has a Heat Result the Bracket is locked
 * (`LOCKED_BY_HEAT_RESULT`): no re-draw clears it.
 */
export async function generateBracket(
  competitionId: string,
  options: {
    rng?: () => number;
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
    const config = configOf(found);
    const configRefusal = validateConfig(config, entrants.length);
    if (configRefusal) return refuse(configRefusal);
    if (hasResults(await bracketOf(tx, found))) {
      return refuse(LOCKED_BY_HEAT_RESULT);
    }

    const rng = options.rng ?? Math.random;
    const seeded = shuffleSeedPositions(
      entrants.map((e) => e.id),
      rng,
    );
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
  await saveBracket(
    tx,
    bracket,
    next,
    reporter && { ...reporter, heatId },
    heatId,
  );
  return { ok: true as const, resetHeatIds };
}

/**
 * Finalizes a finished Bracket: replaces its generated Points Entries with
 * new ones from the final placings and Placement Points, and marks it
 * finalized.
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
          warWeekId: ctx.warWeekId,
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
 * un-finalize or re-finalize; a Head-to-head, Best score, Participation
 * or Placement Competition's on Reopen.
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
