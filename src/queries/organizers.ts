import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, competitionHost, organizer } from "@/db/schema";
import { hostName } from "@/lib/competitions";
import { getProfilesByEmail } from "@/queries/profile-join";

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

/**
 * Each Host email's shown name (`hostName`: Profile name, else the email),
 * for the Organizers' Competitions rows.
 */
export async function getHostNames(
  hosts: Record<string, string[]>,
  dbOrTx: DBOrTx = db,
): Promise<Record<string, string>> {
  const emails = [...new Set(Object.values(hosts).flat())];
  const profiles = await getProfilesByEmail(emails, dbOrTx);
  return Object.fromEntries(emails.map((e) => [e, hostName(e, profiles)]));
}

/** Every Competition's Host emails in a War Week, by Competition id. */
export async function getWarWeekCompetitionHosts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<Record<string, string[]>> {
  const rows = await dbOrTx
    .select({
      competitionId: competitionHost.competitionId,
      email: competitionHost.email,
    })
    .from(competitionHost)
    .innerJoin(competition, eq(competition.id, competitionHost.competitionId))
    .where(eq(competition.warWeekId, warWeekId))
    .orderBy(competitionHost.email);
  const hosts: Record<string, string[]> = {};
  for (const row of rows) {
    (hosts[row.competitionId] ??= []).push(row.email);
  }
  return hosts;
}
