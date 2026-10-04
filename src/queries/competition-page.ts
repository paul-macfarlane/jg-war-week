import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  competitionHost,
  participant,
} from "@/db/schema";
import type { CompetitionLockFacts } from "@/lib/competition-locks";
import { hostNameOnPage } from "@/lib/competition-page";
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
  const [profiles, rosterNames] = await Promise.all([
    getProfilesByEmail(emails, dbOrTx),
    getRosterNames(warWeekId, emails, dbOrTx),
  ]);
  return {
    competition: found,
    facts: await getCompetitionLockFacts(found, dbOrTx),
    hostEmails: withHostEmails ? emails : [],
    hostNames: emails.map((email) =>
      hostNameOnPage(email, profiles, rosterNames),
    ),
  };
}

/** The War Week's roster names of these emails, by lowercase email. */
async function getRosterNames(
  warWeekId: string,
  emails: string[],
  dbOrTx: DBOrTx,
): Promise<Map<string, string>> {
  const keys = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  if (keys.length === 0) return new Map();
  const rows = await dbOrTx
    .select({ email: participant.email, name: participant.displayName })
    .from(participant)
    .where(
      and(
        eq(participant.warWeekId, warWeekId),
        inArray(sql<string>`lower(${participant.email})`, keys),
      ),
    );
  return new Map(
    rows.flatMap(({ email, name }) =>
      email ? [[email.trim().toLowerCase(), name] as const] : [],
    ),
  );
}
