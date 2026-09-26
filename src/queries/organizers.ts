import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, competitionHost, organizer } from "@/db/schema";

/** Emails compare trimmed and lowercased; both tables store them lowercased. */
const normalized = (email: string) => email.trim().toLowerCase();

/** The global Organizer list, by email. */
export function getOrganizers(
  dbOrTx: DBOrTx = db,
): Promise<{ email: string; addedBy: string | null; createdAt: Date }[]> {
  return dbOrTx
    .select({
      email: organizer.email,
      addedBy: organizer.addedBy,
      createdAt: organizer.createdAt,
    })
    .from(organizer)
    .orderBy(organizer.email);
}

/** Whether `email` is on the Organizer list, ignoring case. */
export async function isOrganizerEmail(
  email: string,
  dbOrTx: DBOrTx = db,
): Promise<boolean> {
  const [row] = await dbOrTx
    .select({ id: organizer.id })
    .from(organizer)
    .where(eq(organizer.email, normalized(email)))
    .limit(1);
  return row !== undefined;
}

/** The Competitions `email` hosts, each with its War Week. */
export function getHostedCompetitions(
  email: string,
  dbOrTx: DBOrTx = db,
): Promise<{ competitionId: string; warWeekId: string }[]> {
  return dbOrTx
    .select({
      competitionId: competitionHost.competitionId,
      warWeekId: competition.warWeekId,
    })
    .from(competitionHost)
    .innerJoin(competition, eq(competition.id, competitionHost.competitionId))
    .where(eq(competitionHost.email, normalized(email)));
}

/** A Competition's Host emails, sorted. */
export async function getCompetitionHosts(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<string[]> {
  const rows = await dbOrTx
    .select({ email: competitionHost.email })
    .from(competitionHost)
    .where(eq(competitionHost.competitionId, competitionId))
    .orderBy(competitionHost.email);
  return rows.map((row) => row.email);
}
