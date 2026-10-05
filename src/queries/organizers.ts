import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  competitionHost,
  organizer,
  participant,
  profile,
} from "@/db/schema";
import { isJahnelGroupEmail } from "@/lib/access";
import { participantNameSql, profileOn } from "@/queries/profile-join";

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

/**
 * The Competitions `email` hosts, each with its War Week. Worked out at
 * request time (ADR 0012): the roster Participant whose email is `email`,
 * ignoring case, in the Competition's own War Week, that hosts it. A
 * non-@jahnelgroup.com roster email can never sign in, so it hosts nothing.
 */
export async function getHostedCompetitions(
  email: string,
  dbOrTx: DBOrTx = db,
): Promise<{ competitionId: string; warWeekId: string }[]> {
  // Sign-in rejects every other domain; a roster email off it hosts nothing.
  if (!isJahnelGroupEmail(email)) return [];
  return dbOrTx
    .select({
      competitionId: competitionHost.competitionId,
      warWeekId: competition.warWeekId,
    })
    .from(competitionHost)
    .innerJoin(competition, eq(competition.id, competitionHost.competitionId))
    .innerJoin(
      participant,
      and(
        eq(participant.id, competitionHost.participantId),
        eq(participant.warWeekId, competition.warWeekId),
      ),
    )
    .where(eq(sql`lower(${participant.email})`, normalized(email)));
}

/**
 * Every Competition's Host names in a War Week, by Competition id (the
 * Profile name, else the roster name; never an email).
 */
export async function getWarWeekCompetitionHosts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<Record<string, string[]>> {
  const name = participantNameSql();
  const rows = await dbOrTx
    .select({ competitionId: competitionHost.competitionId, name })
    .from(competitionHost)
    .innerJoin(competition, eq(competition.id, competitionHost.competitionId))
    .innerJoin(participant, eq(participant.id, competitionHost.participantId))
    .leftJoin(profile, profileOn())
    .where(eq(competition.warWeekId, warWeekId))
    .orderBy(name);
  const hosts: Record<string, string[]> = {};
  for (const row of rows) {
    (hosts[row.competitionId] ??= []).push(row.name);
  }
  return hosts;
}
