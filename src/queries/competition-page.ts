import { and, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type Competition, competition, competitionHost } from "@/db/schema";
import type { CompetitionLockFacts } from "@/lib/competition-locks";
import { hostNameWithoutEmail } from "@/lib/competition-page";
import { isUuid } from "@/lib/uuid";
import { getCompetitionLockFacts } from "@/queries/competition-locks";
import { getProfilesByEmail } from "@/queries/profile-join";

export type CompetitionPageData = {
  competition: Competition;
  facts: CompetitionLockFacts;
  /** The Host emails, for an Organizer only; empty for anyone else. */
  hostEmails: string[];
  /** The Hosts' names, never an email (what a Host sees). */
  hostNames: string[];
};

/**
 * One Competition of a War Week for its admin page: the stored row, its
 * lock facts and its Hosts. Host emails load only when `withHostEmails`
 * (an Organizer's page); a Host's page gets names alone, so no other
 * Host's email reaches it. Undefined for a malformed id or one of another
 * War Week.
 */
export async function getCompetitionPage(
  warWeekId: string,
  competitionId: string,
  { withHostEmails }: { withHostEmails: boolean },
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
  const hosts = await dbOrTx
    .select({ email: competitionHost.email })
    .from(competitionHost)
    .where(eq(competitionHost.competitionId, competitionId))
    .orderBy(competitionHost.email);
  const emails = hosts.map((h) => h.email);
  const profiles = await getProfilesByEmail(emails, dbOrTx);
  return {
    competition: found,
    facts: await getCompetitionLockFacts(found, dbOrTx),
    hostEmails: withHostEmails ? emails : [],
    hostNames: emails.map((email) => hostNameWithoutEmail(email, profiles)),
  };
}
