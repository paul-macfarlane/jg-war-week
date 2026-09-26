import { and, count, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  entrant,
  heat,
  heatEntrant,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import {
  applyResult,
  finalPlacings,
  generate,
  hasResults,
  isComplete,
  resetByResult,
} from "@/lib/bracket/engine";
import { pointsFor } from "@/lib/bracket/points";
import { shuffleSeedPositions } from "@/lib/bracket/seeding";
import {
  type Bracket,
  BracketError,
  HAS_RESULTS_ERROR,
  type HeatResult,
} from "@/lib/bracket/types";
import { inUseError } from "@/lib/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getBracketEntrants, loadBracket } from "@/queries/brackets";

const COMPETITION_NOT_FOUND = "That Competition no longer exists.";
const HEAT_NOT_FOUND = "That Heat no longer exists.";
const NOT_A_BRACKET = "This Competition isn't run as a Bracket.";
const FINALIZED = "Un-finalize the Bracket before changing it.";
/** The note on every Points Entry a finalized Bracket generates. */
export const FROM_BRACKET_NOTE = "From bracket";

type BracketCompetition = Pick<
  Competition,
  "id" | "name" | "scoring" | "format" | "placementPoints" | "finalizedAt"
>;

/**
 * Locks a Competition of this War Week for a Bracket write, so two writes
 * to the same Bracket run one after the other.
 */
async function lockedCompetition(
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
      placementPoints: competition.placementPoints,
      finalizedAt: competition.finalizedAt,
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
function bracketRefusal(
  found: BracketCompetition | undefined,
  { allowFinalized = false } = {},
): string | null {
  if (!found) return COMPETITION_NOT_FOUND;
  if (found.format === "points") return NOT_A_BRACKET;
  if (found.finalizedAt && !allowFinalized) return FINALIZED;
  return null;
}

function refuse(error: string): { ok: false; error: string } {
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
      winnerToHeatId: h.winnerTo?.heatId ?? null,
      winnerToSlot: h.winnerTo?.slot ?? null,
    })),
  );
  await insertSlots(tx, bracket);
}

async function insertSlots(tx: DBOrTx, bracket: Bracket) {
  const rows = bracket.heats.flatMap((h) =>
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

/** Writes an existing Bracket's Heat statuses and slots back. */
async function saveBracket(tx: DBOrTx, before: Bracket, after: Bracket) {
  const changed = after.heats.filter(
    (h, i) => JSON.stringify(h) !== JSON.stringify(before.heats[i]),
  );
  if (changed.length === 0) return;
  for (const h of changed) {
    await tx
      .update(heat)
      .set({ status: h.status, updatedAt: sql`now()` })
      .where(eq(heat.id, h.id));
  }
  await tx.delete(heatEntrant).where(
    inArray(
      heatEntrant.heatId,
      changed.map((h) => h.id),
    ),
  );
  await insertSlots(tx, { heats: changed });
}

/** Sets how a Competition is run. Its Format can't change while it has Entrants. */
export async function setCompetitionFormat(
  competitionId: string,
  values: {
    format: Competition["format"];
    bracketPoints?: Competition["bracketPoints"];
  },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    if (found.format !== values.format) {
      const [entrants] = await tx
        .select({ count: count() })
        .from(entrant)
        .where(eq(entrant.competitionId, competitionId));
      const refusal = inUseError(
        "Competition",
        [[entrants.count, "Entrant", "Entrants"]],
        "Remove them before changing its Format.",
      );
      if (refusal) return refuse(refusal);
    }
    await tx
      .update(competition)
      .set({
        format: values.format,
        ...(values.bracketPoints
          ? { bracketPoints: values.bracketPoints }
          : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Replaces a Bracket's Entrants with these Teams or Participants (whichever
 * the Competition's scoring takes), at Seed Positions in the given order.
 * It clears the Bracket; once a Heat has a Heat Result, only with `force`.
 */
export async function replaceEntrants(
  competitionId: string,
  targetIds: string[],
  ctx: MutationContext,
  options: { force?: boolean } = {},
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found);
    if (refusal || !found) return refuse(refusal ?? COMPETITION_NOT_FOUND);
    if (new Set(targetIds).size !== targetIds.length) {
      return refuse("Enter each Team or Participant only once.");
    }

    const isTeam = found.scoring === "team";
    const table = isTeam ? team : participant;
    const valid = targetIds.length
      ? await tx.$count(
          table,
          and(inArray(table.id, targetIds), eq(table.warWeekId, ctx.warWeekId)),
        )
      : 0;
    if (valid !== targetIds.length) {
      return refuse(
        isTeam
          ? `"${found.name}" is a team Competition, so its Entrants must be Teams of this War Week.`
          : `"${found.name}" is an individual Competition, so its Entrants must be Participants of this War Week.`,
      );
    }
    if (!options.force && hasResults(await loadBracket(competitionId, tx))) {
      return refuse(HAS_RESULTS_ERROR);
    }

    await tx.delete(heat).where(eq(heat.competitionId, competitionId));
    await tx.delete(entrant).where(eq(entrant.competitionId, competitionId));
    if (targetIds.length) {
      await tx.insert(entrant).values(
        targetIds.map((id, i) => ({
          competitionId,
          seedPosition: i + 1,
          teamId: isTeam ? id : null,
          participantId: isTeam ? null : id,
        })),
      );
    }
    return { ok: true };
  });
}

/**
 * Seeds the Entrants randomly (by `rng`) and builds the Bracket, byes
 * included. Once a Heat has a Heat Result, regenerating needs `force`,
 * which clears every result.
 */
export async function generateBracket(
  competitionId: string,
  ctx: MutationContext,
  options: { rng?: () => number; force?: boolean } = {},
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found);
    if (refusal) return refuse(refusal);
    const entrants = await getBracketEntrants(competitionId, tx);
    if (entrants.length < 2) return refuse("Add at least 2 Entrants first.");
    if (!options.force && hasResults(await loadBracket(competitionId, tx))) {
      return refuse(HAS_RESULTS_ERROR);
    }

    const seeded = shuffleSeedPositions(
      entrants.map((e) => e.id),
      options.rng ?? Math.random,
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
 * Records a Heat Result and advances the winner. Changing a decided Heat's
 * winner resets the later Heats that followed from it; the ids of those
 * that had a Heat Result are returned. A score-only edit resets nothing.
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
    const refusal = bracketRefusal(found);
    if (refusal) return refuse(refusal);
    const bracket = await loadBracket(competitionId, tx);
    const target = bracket.heats.find((h) => h.id === heatId);
    if (!target) return refuse(HEAT_NOT_FOUND);

    let next: Bracket;
    let resetHeatIds: string[];
    try {
      const forfeits = result.forfeits ?? [];
      const winner = result.order.find((id) => !forfeits.includes(id));
      resetHeatIds = resetByResult(bracket, heatId, winner ?? null);
      next = applyResult(bracket, heatId, result);
    } catch (error) {
      if (error instanceof BracketError) return refuse(error.message);
      throw error;
    }
    await saveBracket(tx, bracket, next);
    return { ok: true as const, resetHeatIds };
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
    if (refusal || !found) return refuse(refusal ?? COMPETITION_NOT_FOUND);
    const bracket = await loadBracket(competitionId, tx);
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
          teamId: byId.get(entrantId)!.teamId,
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

function deleteGenerated(tx: DBOrTx, competitionId: string) {
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
