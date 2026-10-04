import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type WarWeek,
  award,
  awardParticipant,
  participant,
  team,
  warWeek,
} from "@/db/schema";
import { type AwardPreset, awardPresets } from "@/lib/award-names";
import { type AwardView } from "@/lib/awards";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

export type { AwardView };

/** A War Week's Awards by name, each with its Team and Participants. */
export async function getAwards(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<AwardView[]> {
  const rows = await dbOrTx
    .select({
      id: award.id,
      name: award.name,
      description: award.description,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
    })
    .from(award)
    .leftJoin(team, eq(award.teamId, team.id))
    .where(eq(award.warWeekId, warWeek.id))
    .orderBy(asc(award.name), asc(award.id));

  const recipients =
    rows.length === 0
      ? []
      : await withProfile(
          dbOrTx
            .select({
              awardId: awardParticipant.awardId,
              id: participant.id,
              displayName: participantNameSql(),
              image: participantImageSql(),
              teamColor: team.color,
            })
            .from(awardParticipant)
            .innerJoin(
              participant,
              eq(awardParticipant.participantId, participant.id),
            )
            .leftJoin(team, eq(team.id, participant.teamId))
            .$dynamic(),
        )
          .where(
            inArray(
              awardParticipant.awardId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(asc(participantNameSql()));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    team:
      row.teamId && row.teamName && row.teamColor
        ? { id: row.teamId, name: row.teamName, color: row.teamColor }
        : null,
    participants: recipients
      .filter((r) => r.awardId === row.id)
      .map(({ id, displayName, image, teamColor }) => ({
        id,
        displayName,
        image,
        teamColor,
      })),
  }));
}

/**
 * The names an Organizer can add an Award from: every Award name in any War
 * Week (case-insensitive, with its most recent description) and the seven
 * former Category names.
 */
export async function getAwardPresets(
  dbOrTx: DBOrTx = db,
): Promise<AwardPreset[]> {
  const rows = await dbOrTx
    .select({ name: award.name, description: award.description })
    .from(award)
    .innerJoin(warWeek, eq(award.warWeekId, warWeek.id))
    .orderBy(desc(warWeek.editionNumber), desc(award.createdAt), asc(award.id));
  return awardPresets(rows);
}

export type AwardFormOptions = {
  teams: { id: string; name: string }[];
  /** `team` is the Participant's Team name, when they have one. */
  participants: { id: string; name: string; team: string | null }[];
  /** Award names to start from (see `awardPresets`). */
  presets: AwardPreset[];
};

/** The Teams, Participants and name presets an Award of this War Week may use. */
export async function getAwardFormOptions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<AwardFormOptions> {
  const [teams, participants, presets] = await Promise.all([
    dbOrTx
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(eq(team.warWeekId, warWeek.id))
      .orderBy(asc(team.name)),
    withProfile(
      dbOrTx
        .select({
          id: participant.id,
          name: participantNameSql(),
          team: team.name,
        })
        .from(participant)
        .leftJoin(team, eq(team.id, participant.teamId))
        .$dynamic(),
    )
      .where(eq(participant.warWeekId, warWeek.id))
      .orderBy(asc(participantNameSql())),
    getAwardPresets(dbOrTx),
  ]);
  return { teams, participants, presets };
}

/**
 * Whether a Team (when given) and every Participant belong to the War Week,
 * so an Award never names another War Week's recipients.
 */
export async function recipientsInWarWeek(
  warWeekId: string,
  recipients: { teamId: string | null; participantIds: string[] },
  dbOrTx: DBOrTx = db,
): Promise<{ team: boolean; participants: boolean }> {
  const [teams, participants] = await Promise.all([
    recipients.teamId
      ? dbOrTx
          .select({ id: team.id })
          .from(team)
          .where(
            and(eq(team.id, recipients.teamId), eq(team.warWeekId, warWeekId)),
          )
      : Promise.resolve([{ id: null }]),
    recipients.participantIds.length
      ? dbOrTx
          .select({ id: participant.id })
          .from(participant)
          .where(
            and(
              inArray(participant.id, recipients.participantIds),
              eq(participant.warWeekId, warWeekId),
            ),
          )
      : Promise.resolve([]),
  ]);
  return {
    team: teams.length > 0,
    participants: participants.length === recipients.participantIds.length,
  };
}
