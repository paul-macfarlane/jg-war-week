import { and, count, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type Competition, attempt, competition } from "@/db/schema";
import { can } from "@/lib/access";
import { maxAttemptsError } from "@/lib/best-score/log-rule";
import { settingLockReason } from "@/lib/competition-locks";
import type { CompetitionSettingChange } from "@/lib/competition-settings";
import { NOT_PARTICIPATION } from "@/lib/participation/check-in-rule";
import type { CompetitionValues } from "@/lib/setup";
import {
  COMPETITION_NOT_FOUND,
  NOT_A_BRACKET,
  generateBracket,
  refuse,
  replaceEntrants,
  setCompetitionFormat,
} from "@/mutations/brackets";
import { setSelfEnroll } from "@/mutations/enrollment";
import { setSelfReport } from "@/mutations/match-reports";
import { setParticipationSettings } from "@/mutations/participation";
import { setSeriesConfig } from "@/mutations/series";
import { setCompetitionHosts, updateCompetition } from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getCompetitionLockFacts } from "@/queries/competition-locks";
import { getHostedCompetitions, isOrganizerEmail } from "@/queries/organizers";

const COUNTS_TOWARD_TEAM_INDIVIDUAL_ONLY =
  "Only an individual Competition can count toward the Team.";
const NO_PARTICIPATION_DIRECTION =
  "A Participation Competition has no Score direction.";
const BEST_SCORE_NEEDS_DIRECTION =
  "A Best score Competition's Score is higher or lower is better.";
const NOT_BEST_SCORE = "This Competition isn't run as Best score.";
const INDIVIDUAL_PARTICIPATION_ONLY =
  "Only an individual Participation Competition takes points per Participant.";
const INDIVIDUAL_NO_PLACEMENT_POINTS =
  "An individual Participation Competition gives points to each Participant, not Placement Points.";
const PLACEMENT_POINTS_REQUIRED = "Enter the Placement Points.";

/**
 * Why the actor can't save `field` on this Competition, or null, by the one
 * access rule (`can`, ADR 0002) with the actor's role read in this
 * transaction: an Organizer saves any field; a Host of this Competition any
 * but Hosts; anyone else none ("not a Host", whichever the field).
 */
async function roleRefusal(
  tx: DBOrTx,
  field: CompetitionSettingChange["field"],
  competitionId: string,
  ctx: MutationContext,
): Promise<string | null> {
  const actor = {
    email: ctx.actorEmail,
    isOrganizer: await isOrganizerEmail(ctx.actorEmail, tx),
    hosts: await getHostedCompetitions(ctx.actorEmail, tx),
  };
  const target = { warWeekId: ctx.warWeekId, competitionId };
  return (
    can(actor, "competition.edit", target) ??
    (field === "hosts" ? can(actor, "competition.assign-hosts", target) : null)
  );
}

/** A refusal shown at the field that was saved. */
function atField(field: string, result: MutationResult): MutationResult {
  if (result.ok || result.fieldErrors) return result;
  return { ...result, fieldErrors: { [field]: result.error } };
}

/**
 * Saves one setting of a Competition (the admin Competition page's
 * autosave). Under the Competition's row lock, refuses, in order: a
 * Competition outside `ctx.warWeekId`; an actor who may not save the field
 * (`roleRefusal`); a locked field, with its one-line reason
 * (`settingLockReason`); then the field's own rules. The write itself goes
 * through the setting's own mutation where there is one.
 */
export async function saveCompetitionSetting(
  competitionId: string,
  change: CompetitionSettingChange,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const [found] = await tx
      .select()
      .from(competition)
      .where(
        and(
          eq(competition.id, competitionId),
          eq(competition.warWeekId, ctx.warWeekId),
        ),
      )
      .for("update");
    if (!found) return atField(change.field, refuse(COMPETITION_NOT_FOUND));
    const denied = await roleRefusal(tx, change.field, competitionId, ctx);
    if (denied) return atField(change.field, refuse(denied));
    const locked = settingLockReason(
      change.field,
      await getCompetitionLockFacts(found, tx),
    );
    if (locked) return atField(change.field, refuse(locked));
    return atField(change.field, await write(tx, found, change, ctx));
  });
}

/** The Competition's setup fields as stored, for `updateCompetition`. */
function setupValues(found: Competition): CompetitionValues {
  return {
    name: found.name,
    description: found.description,
    scoring: found.scoring,
    placementPoints: found.placementPoints,
    countsTowardTeam: found.countsTowardTeam,
    competitionGroup: found.competitionGroup,
  };
}

/** Writes one unlocked setting the actor may save. */
async function write(
  tx: DBOrTx,
  found: Competition,
  change: CompetitionSettingChange,
  ctx: MutationContext,
): Promise<MutationResult> {
  const id = found.id;
  const setup = (values: Partial<CompetitionValues>) =>
    updateCompetition(id, { ...setupValues(found), ...values }, ctx, tx);
  const enroll = (
    values: Partial<{ on: boolean; entrantLimit: number | null }>,
  ) =>
    setSelfEnroll(
      id,
      {
        on: found.selfEnroll,
        entrantLimit: found.entrantLimit,
        ...values,
      },
      ctx,
      tx,
    );
  const checkIn = (values: Partial<{ selfCheckIn: boolean }>) =>
    found.format === "participation"
      ? setParticipationSettings(
          id,
          {
            participationPoints: found.participationPoints,
            placementPoints: found.placementPoints,
            selfCheckIn: found.selfCheckIn,
            ...values,
          },
          ctx,
          tx,
        )
      : Promise.resolve(refuse(NOT_PARTICIPATION));
  const set = async (values: Partial<Competition>) => {
    await tx
      .update(competition)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(competition.id, id));
    return { ok: true } as const;
  };

  switch (change.field) {
    case "name":
      return setup({ name: change.value });
    case "description":
      return setup({ description: change.value });
    case "group":
      return setup({ competitionGroup: change.value });
    case "hosts":
      return setCompetitionHosts(id, change.value, ctx, tx);
    case "placementPoints":
      if (found.format === "participation") {
        if (found.scoring === "individual") {
          return refuse(INDIVIDUAL_NO_PLACEMENT_POINTS);
        }
        if (!change.value?.length) return refuse(PLACEMENT_POINTS_REQUIRED);
      }
      return setup({ placementPoints: change.value });
    case "participationPoints":
      if (found.format !== "participation" || found.scoring !== "individual") {
        return refuse(INDIVIDUAL_PARTICIPATION_ONLY);
      }
      return set({ participationPoints: change.value });
    case "scoring":
      // Team scoring can't count toward the Team: it already does.
      return setup({
        scoring: change.value,
        countsTowardTeam:
          change.value === "team" ? false : found.countsTowardTeam,
      });
    case "countsTowardTeam":
      if (change.value && found.scoring !== "individual") {
        return refuse(COUNTS_TOWARD_TEAM_INDIVIDUAL_ONLY);
      }
      return setup({ countsTowardTeam: change.value });
    case "format":
      return setCompetitionFormat(id, { format: change.value }, ctx, tx);
    case "bracketConfig":
      if (found.format !== "bracket") return refuse(NOT_A_BRACKET);
      return setCompetitionFormat(
        id,
        { format: "bracket", config: change.value },
        ctx,
        tx,
      );
    case "scoreDirection":
      // The CHECK `competition_score_direction_by_format`, as refusals.
      if (found.format === "participation") {
        return refuse(NO_PARTICIPATION_DIRECTION);
      }
      if (found.format === "best-score" && change.value === "none") {
        return refuse(BEST_SCORE_NEEDS_DIRECTION);
      }
      return set({ scoreDirection: change.value });
    case "scoreUnit":
      return set({ scoreUnit: change.value });
    case "seriesConfig":
      return setSeriesConfig(id, change.value, ctx, tx);
    case "bestScoreConfig":
      if (found.format !== "best-score") return refuse(NOT_BEST_SCORE);
      return set({ bestScoreConfig: change.value });
    case "entrants":
      return replaceEntrants(id, change.value, ctx, tx);
    case "bracket":
      return generateBracket(id, {}, ctx, tx);
    case "selfEnroll":
      return enroll({ on: change.value });
    case "entrantLimit":
      return enroll({ entrantLimit: change.value });
    case "selfReport":
      return setSelfReport(id, { on: change.value }, ctx, tx);
    case "selfCheckIn":
      return checkIn({ selfCheckIn: change.value });
    case "maxAttempts": {
      if (found.format !== "best-score") return refuse(NOT_BEST_SCORE);
      const [most] = await tx
        .select({ n: count() })
        .from(attempt)
        .where(eq(attempt.competitionId, id))
        .groupBy(attempt.participantId)
        .orderBy(sql`count(*) desc`)
        .limit(1);
      const refusal = maxAttemptsError(change.value, most?.n ?? 0);
      if (refusal) return refuse(refusal);
      return set({ maxAttempts: change.value });
    }
  }
}
