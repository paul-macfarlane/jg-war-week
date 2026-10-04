import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type Competition, competition } from "@/db/schema";
import { can } from "@/lib/access";
import { settingLockReason } from "@/lib/competition-locks";
import type { CompetitionSettingChange } from "@/lib/competition-settings";
import { type GameFormat, isGameFormat } from "@/lib/enums";
import { gamesConfigOf, gamesConfigSchema } from "@/lib/games/config";
import type { GamesSettingsInput } from "@/lib/games/input";
import { NOT_GAMES } from "@/lib/games/log-rule";
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
import { setGamesSettings } from "@/mutations/games";
import { setSelfReport } from "@/mutations/heat-reports";
import { setParticipationSettings } from "@/mutations/participation";
import { setCompetitionHosts, updateCompetition } from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getCompetitionLockFacts } from "@/queries/competition-locks";
import { getHostedCompetitions, isOrganizerEmail } from "@/queries/organizers";

const COUNTS_TOWARD_TEAM_INDIVIDUAL_ONLY =
  "Only an individual Competition can count toward the Team.";
const NOT_PLACEMENT_DIRECTION =
  "Only a Placement Competition has a Score direction.";
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

/** A Head-to-head or Best score Competition's settings as stored. */
function gamesSettings(
  found: Competition & { format: GameFormat },
): GamesSettingsInput {
  return {
    gameConfig: gamesConfigOf(found),
    entrantsOpen: found.entrantsOpen,
    loggingClosesAt: found.loggingClosesAt,
    selfEnroll: found.selfEnroll,
    entrantLimit: found.entrantLimit,
    enrollClosesAt: found.enrollClosesAt,
  };
}

function isGames(
  found: Competition,
): found is Competition & { format: GameFormat } {
  return isGameFormat(found.format);
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
  const games = (values: Partial<GamesSettingsInput>) =>
    isGames(found)
      ? setGamesSettings(id, { ...gamesSettings(found), ...values }, ctx, tx)
      : Promise.resolve(refuse(NOT_GAMES));
  const enroll = (
    values: Partial<{
      on: boolean;
      entrantLimit: number | null;
      enrollClosesAt: Date | null;
    }>,
  ) =>
    setSelfEnroll(
      id,
      {
        on: found.selfEnroll,
        entrantLimit: found.entrantLimit,
        enrollClosesAt: found.enrollClosesAt,
        ...values,
      },
      ctx,
      tx,
    );
  const checkIn = (
    values: Partial<{ selfCheckIn: boolean; checkInClosesAt: Date | null }>,
  ) =>
    found.format === "participation"
      ? setParticipationSettings(
          id,
          {
            participationPoints: found.participationPoints,
            placementPoints: found.placementPoints,
            selfCheckIn: found.selfCheckIn,
            checkInClosesAt: found.checkInClosesAt,
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
      if (found.format !== "placement") return refuse(NOT_PLACEMENT_DIRECTION);
      return set({ scoreDirection: change.value });
    case "gameConfig": {
      if (!isGames(found)) return refuse(NOT_GAMES);
      const config = gamesConfigSchema(found.format).safeParse(change.value);
      if (!config.success) return refuse(config.error.issues[0].message);
      return games({ gameConfig: config.data });
    }
    case "entrantsOpen":
      return games({ entrantsOpen: change.value });
    case "loggingClosesAt":
      return games({ loggingClosesAt: change.value });
    case "entrants":
      return replaceEntrants(id, change.value, ctx, tx);
    case "bracket":
      return generateBracket(id, {}, ctx, tx);
    case "selfEnroll":
      return enroll({ on: change.value });
    case "entrantLimit":
      return enroll({ entrantLimit: change.value });
    case "enrollClosesAt":
      return enroll({ enrollClosesAt: change.value });
    case "selfReport":
      return setSelfReport(id, { on: change.value }, ctx, tx);
    case "selfCheckIn":
      return checkIn({ selfCheckIn: change.value });
    case "checkInClosesAt":
      return checkIn({ checkInClosesAt: change.value });
  }
}
