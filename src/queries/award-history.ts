import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  award,
  awardParticipant,
  participant,
  team,
  warWeek,
} from "@/db/schema";
import {
  type AwardHistoryAward,
  type AwardNameHistory,
  awardNameList,
  awardNameSlug,
} from "@/lib/award-names";
import { participantNameSql, withProfile } from "@/queries/profile-join";

/**
 * An Award name's Awards in every War Week (any status), newest first by
 * Edition number, each with its Team and its Participants by shown name
 * (the Profile name where linked, else the roster name; ADR 0007). The name
 * is matched by slug, so case and punctuation don't split it. Null when no
 * Award has that name. Nothing about Points.
 */
export async function getAwardNameHistory(
  slug: string,
  dbOrTx: DBOrTx = db,
): Promise<AwardNameHistory | null> {
  if (awardNameSlug(slug) !== slug || slug === "") return null;

  const all = await dbOrTx
    .select({
      id: award.id,
      name: award.name,
      edition: warWeek.edition,
      year: warWeek.year,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
    })
    .from(award)
    .innerJoin(warWeek, eq(award.warWeekId, warWeek.id))
    .leftJoin(team, eq(award.teamId, team.id))
    .orderBy(desc(warWeek.editionNumber), asc(award.name), asc(award.id));
  const rows = all.filter((row) => awardNameSlug(row.name) === slug);
  if (rows.length === 0) return null;

  const recipients = await withProfile(
    dbOrTx
      .select({
        awardId: awardParticipant.awardId,
        id: participant.id,
        displayName: participantNameSql(),
        teamName: team.name,
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
      and(
        inArray(
          awardParticipant.awardId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .orderBy(asc(participantNameSql()), asc(participant.id));

  const warWeeks: AwardNameHistory["warWeeks"] = [];
  for (const row of rows) {
    const entry: AwardHistoryAward = {
      id: row.id,
      name: row.name,
      team:
        row.teamId && row.teamName && row.teamColor
          ? { id: row.teamId, name: row.teamName, color: row.teamColor }
          : null,
      participants: recipients
        .filter((r) => r.awardId === row.id)
        .map(({ id, displayName, teamName, teamColor }) => ({
          id,
          displayName,
          teamName,
          teamColor,
        })),
    };
    // Rows arrive grouped by War Week, newest first.
    const last = warWeeks.at(-1);
    if (last?.edition === row.edition) last.awards.push(entry);
    else
      warWeeks.push({ edition: row.edition, year: row.year, awards: [entry] });
  }

  return { name: rows[0].name, warWeeks };
}

/** The Award names with at least one Award, by name: the History list. */
export async function getAwardNamesWithHistory(
  dbOrTx: DBOrTx = db,
): Promise<{ slug: string; name: string }[]> {
  const rows = await dbOrTx
    .selectDistinct({ name: award.name, editionNumber: warWeek.editionNumber })
    .from(award)
    .innerJoin(warWeek, eq(award.warWeekId, warWeek.id))
    .orderBy(desc(warWeek.editionNumber), asc(award.name));
  return awardNameList(rows.map((r) => r.name));
}
