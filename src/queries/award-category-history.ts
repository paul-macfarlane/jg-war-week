import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  award,
  awardCategory,
  awardParticipant,
  participant,
  team,
  warWeek,
} from "@/db/schema";
import type {
  CategoryHistory,
  CategoryHistoryAward,
} from "@/lib/award-categories";
import { participantNameSql, withProfile } from "@/queries/profile-join";

/**
 * A Category's Awards in every War Week (any status), newest first by
 * Edition number, each with its Team and its Participants by shown name
 * (the Profile name where linked, else the roster name; ADR 0007). Null
 * when no such Category. Nothing about Points.
 */
export async function getCategoryHistory(
  categoryId: string,
  dbOrTx: DBOrTx = db,
): Promise<CategoryHistory | null> {
  const [category] = await dbOrTx
    .select({
      id: awardCategory.id,
      name: awardCategory.name,
      archivedAt: awardCategory.archivedAt,
    })
    .from(awardCategory)
    .where(eq(awardCategory.id, categoryId));
  if (!category) return null;

  const rows = await dbOrTx
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
    .where(eq(award.categoryId, categoryId))
    .orderBy(desc(warWeek.editionNumber), asc(award.name), asc(award.id));

  const recipients =
    rows.length === 0
      ? []
      : await withProfile(
          dbOrTx
            .select({
              awardId: awardParticipant.awardId,
              id: participant.id,
              displayName: participantNameSql(),
            })
            .from(awardParticipant)
            .innerJoin(
              participant,
              eq(awardParticipant.participantId, participant.id),
            )
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

  const warWeeks: CategoryHistory["warWeeks"] = [];
  for (const row of rows) {
    const entry: CategoryHistoryAward = {
      id: row.id,
      name: row.name,
      team:
        row.teamId && row.teamName && row.teamColor
          ? { id: row.teamId, name: row.teamName, color: row.teamColor }
          : null,
      participants: recipients
        .filter((r) => r.awardId === row.id)
        .map(({ id, displayName }) => ({ id, displayName })),
    };
    // Rows arrive grouped by War Week, newest first.
    const last = warWeeks.at(-1);
    if (last?.edition === row.edition) last.awards.push(entry);
    else
      warWeeks.push({ edition: row.edition, year: row.year, awards: [entry] });
  }

  return {
    category: {
      id: category.id,
      name: category.name,
      archived: category.archivedAt !== null,
    },
    warWeeks,
  };
}

/** The Categories with at least one Award, by name: the History list. */
export async function getCategoriesWithAwards(
  dbOrTx: DBOrTx = db,
): Promise<{ id: string; name: string; archived: boolean }[]> {
  const rows = await dbOrTx
    .selectDistinct({
      id: awardCategory.id,
      name: awardCategory.name,
      archivedAt: awardCategory.archivedAt,
    })
    .from(awardCategory)
    .innerJoin(award, eq(award.categoryId, awardCategory.id))
    .orderBy(asc(awardCategory.name), asc(awardCategory.id));
  return rows.map(({ id, name, archivedAt }) => ({
    id,
    name,
    archived: archivedAt !== null,
  }));
}
