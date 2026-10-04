import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  bracketMatch,
  bracketMatchEntrant,
  competition,
  entrant,
  participant,
  pointsEntry,
  seriesMatch,
  seriesMatchEntrant,
  squad,
  squadParticipant,
  team,
  warWeek,
} from "@/db/schema";
import { clearResult, otherResultsChanged } from "@/lib/bracket/clear-result";
import {
  type BracketConfig,
  configOf,
  kindOf,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import {
  applyResult,
  generate,
  hasResults,
  validateConfig,
} from "@/lib/bracket/formats";
import { shuffleSeedPositions } from "@/lib/bracket/seeding";
import {
  LATER_MATCH_USED,
  matchReportState,
  matchResultError,
} from "@/lib/bracket/self-report";
import {
  type EntrantKind,
  entrantKindError,
  squadError,
} from "@/lib/bracket/squads";
import {
  type Bracket,
  BracketError,
  type BracketFormat,
  type MatchResult,
} from "@/lib/bracket/types";
import { isBracketFormat } from "@/lib/bracket/view";
import {
  LOCKED_BY_MATCH_RESULT,
  settingLockReason,
} from "@/lib/competition-locks";
import { isLoggedFormat } from "@/lib/enums";
import { formatDefaults } from "@/lib/format-defaults";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getBracketEntrants, loadBracket } from "@/queries/brackets";
import { getCompetitionLockFacts } from "@/queries/competition-locks";

export const COMPETITION_NOT_FOUND = "That Competition no longer exists.";
export const MATCH_NOT_FOUND = "That Match no longer exists.";
export const NOT_A_BRACKET = "This Competition isn't run as a Bracket.";
export const CLOSED = "Reopen the Bracket before changing it.";
export const SQUAD_NOT_FOUND = "That Squad no longer exists.";
export const ONLY_A_BRACKET_TAKES_MATCHES =
  "Only a Bracket takes Match settings.";
const NOT_A_TEAM_COMPETITION = "Squads are only for team Competitions.";
/** A closed Competition's Entrants or settings can't change. */
export const REOPEN_FIRST = "Reopen the Competition first.";
const NO_SQUADS_IN_HEAD_TO_HEAD = "Squads aren't entered in a Head-to-head.";
export const HEAD_TO_HEAD_NEEDS_TWO =
  "A Head-to-head needs exactly 2 Entrants.";
/** Best score takes no Entrant list (spec R21, decision 5). */
export const BEST_SCORE_NO_ENTRANTS =
  "Best score has no Entrant list: anyone can log an Attempt.";
const NOT_HEAD_TO_HEAD = "This Competition isn't run as Head-to-head.";
/** The note on every Points Entry a closed Bracket generates. */
export const FROM_BRACKET_NOTE = "From bracket";

export type BracketCompetition = Pick<
  Competition,
  | "id"
  | "name"
  | "scoring"
  | "format"
  | "bracketConfig"
  | "placementPoints"
  | "closedAt"
  | "selfEnroll"
  | "entrantLimit"
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
      closedAt: competition.closedAt,
      selfEnroll: competition.selfEnroll,
      entrantLimit: competition.entrantLimit,
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
  { allowClosed = false } = {},
): string | null {
  if (!found) return COMPETITION_NOT_FOUND;
  if (!isBracketFormat(found.format)) return NOT_A_BRACKET;
  if (found.closedAt && !allowClosed) return CLOSED;
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
    a.kind === b.kind &&
    a.entrantsPerMatch === b.entrantsPerMatch &&
    a.advancePerMatch === b.advancePerMatch &&
    a.thirdPlaceMatch === b.thirdPlaceMatch &&
    JSON.stringify(a.rounds) === JSON.stringify(b.rounds)
  );
}

/**
 * How many of a freshly generated Match advance: 1 in a head-to-head
 * Bracket and in the final (the last round's Match that isn't the 3rd
 * place Match), else the round's default.
 */
function advanceCountOf(
  bracket: Bracket,
  match: Bracket["matches"][number],
): number {
  const { config } = bracket;
  if (config.kind === "head-to-head" || match.thirdPlace) return 1;
  const lastRound = Math.max(...bracket.matches.map((m) => m.round));
  if (match.round === lastRound) return 1;
  return (
    config.rounds[String(match.round)]?.advancePerMatch ??
    config.advancePerMatch
  );
}

/** A slot's Score as stored: numeric, or null when blank or not a number. */
function storedScore(score: string | null): number | null {
  if (score === null || score.trim() === "") return null;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

export function refuse(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Inserts a freshly generated Bracket's Matches and slots. */
async function insertBracket(
  tx: DBOrTx,
  competitionId: string,
  bracket: Bracket,
) {
  // One statement, so each winner's (and loser's) Match exists when the row
  // is checked.
  await tx.insert(bracketMatch).values(
    bracket.matches.map((h) => ({
      id: h.id,
      competitionId,
      round: h.round,
      position: h.position,
      status: h.status,
      slotCount: h.slots.length,
      advanceCount: advanceCountOf(bracket, h),
      winnerToMatchId: h.winnerTo?.matchId ?? null,
      winnerToSlot: h.winnerTo?.slot ?? null,
      loserToMatchId: h.loserTo?.matchId ?? null,
      loserToSlot: h.loserTo?.slot ?? null,
      thirdPlace: h.thirdPlace,
      // A freshly generated Match is never played: a re-draw clears results.
      recordedAt: null,
    })),
  );
  await insertSlots(tx, bracket.matches);
}

async function insertSlots(tx: DBOrTx, matches: Bracket["matches"]) {
  const rows = matches.flatMap((h) =>
    h.slots.flatMap((slot, i) =>
      slot.entrantId
        ? [
            {
              matchId: h.id,
              entrantId: slot.entrantId,
              slot: i,
              place: slot.place,
              score: storedScore(slot.score),
            },
          ]
        : [],
    ),
  );
  if (rows.length) await tx.insert(bracketMatchEntrant).values(rows);
}

/** Who self-reported a Match's result; null for a Host or Organizer. */
export type MatchReporter = { email: string; participantId: string };

/**
 * Writes an existing Bracket's Match statuses and slots back, looking each
 * Match up by id. Only Generate adds or removes Matches (and sets their slot counts),
 * so a different set of Match ids here is a programming error.
 *
 * Every changed Match's reporter columns are rewritten too: `reporter`'s for
 * `reporter.matchId`, null for every other changed Match. So a save that
 * changes a self-reported result (or refills or empties a later Match)
 * clears its reporter, and an identical re-save, changing no Match, keeps it.
 *
 * `recordedMatchId` is the Match whose Result is being saved: its `recorded_at`
 * becomes now, even when the save changes nothing else. Any other changed Match
 * that is no longer played (a later Match the result reset) loses its
 * `recorded_at`; a changed Match still played keeps it.
 */
async function saveBracket(
  tx: DBOrTx,
  before: Bracket,
  after: Bracket,
  reporter: (MatchReporter & { matchId: string }) | null,
  recordedMatchId: string,
) {
  const beforeById = new Map(before.matches.map((h) => [h.id, h]));
  if (
    after.matches.length !== before.matches.length ||
    new Set(after.matches.map((h) => h.id)).size !== after.matches.length ||
    after.matches.some((h) => !beforeById.has(h.id))
  ) {
    throw new Error("saveBracket: the Bracket's Match ids changed.");
  }
  const changed = after.matches.filter(
    (h) => JSON.stringify(h) !== JSON.stringify(beforeById.get(h.id)),
  );
  if (!changed.some((h) => h.id === recordedMatchId)) {
    // An identical re-save still records when the Result was saved.
    await tx
      .update(bracketMatch)
      .set({ recordedAt: sql`now()` })
      .where(
        and(
          eq(bracketMatch.id, recordedMatchId),
          eq(bracketMatch.status, "played"),
        ),
      );
  }
  if (changed.length === 0) return;
  for (const h of changed) {
    await tx
      .update(bracketMatch)
      .set({
        status: h.status,
        ...(h.status !== "played"
          ? { recordedAt: null }
          : h.id === recordedMatchId
            ? { recordedAt: sql`now()` }
            : {}),
        reportedByEmail: reporter?.matchId === h.id ? reporter.email : null,
        reportedByParticipantId:
          reporter?.matchId === h.id ? reporter.participantId : null,
        updatedAt: sql`now()`,
      })
      .where(eq(bracketMatch.id, h.id));
  }
  await tx.delete(bracketMatchEntrant).where(
    inArray(
      bracketMatchEntrant.matchId,
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
 * config (`config`, else the default), a Head-to-head's Best of 3, Best
 * score's higher-is-better direction and Team score, a Participation
 * Competition's points columns. The old Format's settings go: the Score
 * direction back to none (Best score's to higher), the unit and Max
 * attempts cleared, Self-report, self-enroll and Self check-in off, a Bracket's Squads deleted. Placement Points are kept
 * (the first 4 for a Bracket; none for an individual Participation
 * Competition, which takes points per Participant instead).
 *
 * A Bracket's config locks once a Match has a result
 * (`settingLockReason("bracketConfig")`); before that a different config
 * clears the drawn Matches, keeping the Entrants. Omitting the config keeps
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
  // The kind always follows the sizes (head-to-head is 2 / 1).
  if (values.config) {
    const { entrantsPerMatch, advancePerMatch } = values.config;
    values = {
      ...values,
      config: {
        ...values.config,
        kind: kindOf(entrantsPerMatch, advancePerMatch),
      },
    };
  }
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    if (values.config != null && values.format !== "bracket") {
      return refuse(ONLY_A_BRACKET_TAKES_MATCHES);
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
    // A 3rd place Match needs 2 / 1 and 4 Entrants, entered or not yet.
    const thirdPlace = thirdPlaceRefusal(values.config, entrants);
    if (thirdPlace) return refuse(thirdPlace);
    if (entrants >= 2) {
      const refusal = validateConfig(values.config, entrants);
      if (refusal) return refuse(refusal);
    }
    // No Match has a result: the drawn Matches go, the Entrants stay.
    await tx
      .delete(bracketMatch)
      .where(eq(bracketMatch.competitionId, competitionId));
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
      // Each Format's defaults, Best score's `higher` direction among them,
      // in the one update so the Format CHECKs never see a half change.
      ...defaults,
      scoreUnit: null,
      maxAttempts: null,
      selfReport: false,
      selfEnroll: false,
      entrantLimit: null,
      selfCheckIn: false,
      updatedAt: sql`now()`,
    })
    .where(eq(competition.id, found.id));
  return { ok: true };
}

/**
 * Replaces a Bracket's Entrants with these Teams, Participants or Squads of
 * one `kind` (omitted: whichever the Competition's scoring takes), at Seed
 * Positions in the given order. Squads must be this Competition's. It
 * clears the drawn Bracket; once a Match has a Match Result the Entrants are
 * locked (`LOCKED_BY_MATCH_RESULT`).
 *
 * A Head-to-head's two Entrants (spec R21, decision 12) take the same
 * Teams or Participants (never Squads), exactly 2, in the order added.
 * Its Matches reference the Entrant rows, so once a Match is logged its
 * Entrants can't change until the Matches are deleted. Best score has no
 * Entrant list.
 *
 * `format` says which the caller sets: a Bracket's Entrants refuse a
 * Head-to-head, a Head-to-head's refuse any other Format.
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
    format?: "bracket" | "head-to-head";
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (found?.format === "best-score") return refuse(BEST_SCORE_NO_ENTRANTS);
    const isSeries = found !== undefined && isLoggedFormat(found.format);
    if (found && format === "head-to-head" && !isSeries) {
      return refuse(NOT_HEAD_TO_HEAD);
    }
    if (found && format === "bracket" && isSeries) return refuse(NOT_A_BRACKET);
    if (isSeries) {
      if (found.closedAt) return refuse(REOPEN_FIRST);
      if (givenKind === "squad") return refuse(NO_SQUADS_IN_HEAD_TO_HEAD);
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
    if (isSeries) {
      if (targetIds.length !== 2) return refuse(HEAD_TO_HEAD_NEEDS_TWO);
      const current = await tx
        .select({
          teamId: entrant.teamId,
          participantId: entrant.participantId,
        })
        .from(entrant)
        .where(eq(entrant.competitionId, competitionId))
        .orderBy(asc(entrant.seedPosition));
      const currentIds = current.map((e) => (e.teamId ?? e.participantId)!);
      // The same two in the same order: nothing to change.
      if (currentIds.join() === targetIds.join()) return { ok: true };
      const played = await seriesPlayerOf(tx, competitionId);
      if (played) {
        return refuse(`${played} has logged Matches. Delete them first.`);
      }
    } else {
      if (isBracketRun(found) && hasResults(await bracketOf(tx, found))) {
        return refuse(LOCKED_BY_MATCH_RESULT);
      }
      await tx
        .delete(bracketMatch)
        .where(eq(bracketMatch.competitionId, competitionId));
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
 * The name of an Entrant of this Head-to-head who plays in one of its
 * Matches, or null when no Match is logged. Matches reference the Entrant
 * rows, so replacing the Entrants would delete them.
 */
async function seriesPlayerOf(
  tx: DBOrTx,
  competitionId: string,
): Promise<string | null> {
  const [played] = await tx
    .select({ teamName: team.name, participantName: participant.displayName })
    .from(seriesMatchEntrant)
    .innerJoin(
      seriesMatch,
      eq(seriesMatch.id, seriesMatchEntrant.seriesMatchId),
    )
    .innerJoin(entrant, eq(entrant.id, seriesMatchEntrant.entrantId))
    .leftJoin(team, eq(team.id, entrant.teamId))
    .leftJoin(participant, eq(participant.id, entrant.participantId))
    .where(eq(seriesMatch.competitionId, competitionId))
    .orderBy(asc(team.name), asc(participant.displayName))
    .limit(1);
  return played ? (played.teamName ?? played.participantName) : null;
}

/**
 * Draws the Seed Positions at random (by `rng`) and builds the Bracket,
 * byes included. Once a Match has a Match Result the Bracket is locked
 * (`LOCKED_BY_MATCH_RESULT`): no re-draw clears it.
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
      return refuse(LOCKED_BY_MATCH_RESULT);
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
    await tx
      .delete(bracketMatch)
      .where(eq(bracketMatch.competitionId, competitionId));
    await insertBracket(tx, competitionId, bracket);
    return { ok: true };
  });
}

/**
 * Records a Match Result and advances who goes on, per the Format. A
 * decided Match's result changes only while no later Match has used it
 * (spec R21, D1c): nothing that already has a result is ever reset.
 */
export async function recordMatchResult(
  competitionId: string,
  matchId: string,
  result: MatchResult,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx) => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    return writeMatchResult(tx, found, matchId, result, null);
  });
}

/**
 * Clears a Match's result (spec R21, S4): its places and Scores go, and
 * who it sent on leaves the unplayed Matches they went to. Refused, for
 * everyone, once a later Match used the result (D1c).
 */
export async function clearMatchResult(
  competitionId: string,
  matchId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx) => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    return writeMatchResult(tx, found, matchId, null, null);
  });
}

/**
 * The one Match Result write, shared by a Host's record or clear and a
 * Participant's self-report, run with the Competition's row lock already
 * held: refuses a Competition that can't change, finds the Match in its
 * own Bracket, refuses a result a later Match already used, applies the
 * result (or, for `null`, clears it) per the Format, refuses a write that
 * would change any other recorded result (the backstop), and saves it
 * with its reporter (null for a Host or Organizer, and on a clear).
 */
export async function writeMatchResult(
  tx: DBOrTx,
  found: BracketCompetition | undefined,
  matchId: string,
  result: MatchResult | null,
  reporter: MatchReporter | null,
): Promise<MutationResult> {
  const refusal = bracketRefusal(found);
  if (refusal || !isBracketRun(found)) {
    return refuse(refusal ?? NOT_A_BRACKET);
  }
  const bracket = await bracketOf(tx, found);
  const target = bracket.matches.find((h) => h.id === matchId);
  if (!target) return refuse(MATCH_NOT_FOUND);
  const used = matchResultError(matchReportState(bracket, target));
  if (used) return refuse(used);

  let next: Bracket;
  try {
    next = result
      ? applyResult(bracket, matchId, result)
      : clearResult(bracket, matchId);
  } catch (error) {
    if (error instanceof BracketError) return refuse(error.message);
    throw error;
  }
  if (otherResultsChanged(bracket, next, matchId)) {
    return refuse(LATER_MATCH_USED);
  }
  await saveBracket(
    tx,
    bracket,
    next,
    reporter && result ? { ...reporter, matchId } : null,
    matchId,
  );
  return { ok: true };
}

/**
 * Deletes a Competition's generated Points Entries: a Bracket's on
 * reopen or re-close; a Head-to-head, Best score, Participation
 * or Placement Competition's on Reopen.
 */
export function deleteGenerated(tx: DBOrTx, competitionId: string) {
  return tx
    .delete(pointsEntry)
    .where(
      and(
        eq(pointsEntry.competitionId, competitionId),
        eq(pointsEntry.generated, true),
      ),
    );
}

/** A Squad's name, Team and Participants, as the Squad form posts them. */
export type SquadValues = {
  name: string;
  teamId: string | null;
  participantIds: string[];
};

/**
 * The Competition, locked, if Squads of it may be written: refuses one that
 * isn't a Bracket, is closed or isn't team-scoring.
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
 * Matches are untouched.
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
