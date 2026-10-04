import { and, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  competitionHost,
  participant,
  profile,
} from "@/db/schema";
import type { CompetitionLockFacts } from "@/lib/competition-locks";
import { isUuid } from "@/lib/uuid";
import { getCompetitionLockFacts } from "@/queries/competition-locks";
import { participantNameSql, profileOn } from "@/queries/profile-join";

export type CompetitionPageData = {
  competition: Competition;
  facts: CompetitionLockFacts;
  /** The Hosts' Participant ids, what the Hosts picker holds. */
  hostIds: string[];
  /** The Hosts' names, never an email. */
  hostNames: string[];
};

/**
 * One Competition of a War Week for its admin page: the stored row, its
 * lock facts and its Hosts (Participants, by id and shown name; no email
 * reaches the page). Undefined for a malformed id or one of another War
 * Week.
 */
export async function getCompetitionPage(
  warWeekId: string,
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<CompetitionPageData | undefined> {
  if (!isUuid(competitionId)) return undefined;
  const [found] = await dbOrTx
    .select()
    .from(competition)
    .where(
      and(
        eq(competition.id, competitionId),
        eq(competition.warWeekId, warWeekId),
      ),
    );
  if (!found) return undefined;
  const name = participantNameSql();
  const hosts = await dbOrTx
    .select({ id: participant.id, name })
    .from(competitionHost)
    .innerJoin(participant, eq(participant.id, competitionHost.participantId))
    .leftJoin(profile, profileOn())
    .where(eq(competitionHost.competitionId, competitionId))
    .orderBy(name);
  return {
    competition: found,
    facts: await getCompetitionLockFacts(found, dbOrTx),
    hostIds: hosts.map((h) => h.id),
    hostNames: hosts.map((h) => h.name),
  };
}
