import { Client } from "pg";

import { E2E_EMAIL_PATTERN, E2E_EXACT_EMAILS } from "./env";

/** Runs one query on its own connection, as `scripts/smoke/harness.ts` does. */
export async function runQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Deletes every e2e user (their sessions cascade), Profile, Organizer row
 * and Host row (the e2e Host's `competition_host` rows), plus the users,
 * Profiles and Organizer rows of the exact `E2E_EXACT_EMAILS` (no `LIKE`
 * wildcards).
 */
export async function deleteE2eUsers() {
  await runQuery(`delete from "user" where email like $1`, [E2E_EMAIL_PATTERN]);
  await runQuery(`delete from "user" where email = any($1::text[])`, [
    E2E_EXACT_EMAILS,
  ]);
  await runQuery(`delete from profile where email like $1`, [
    E2E_EMAIL_PATTERN,
  ]);
  await runQuery(`delete from profile where email = any($1::text[])`, [
    E2E_EXACT_EMAILS,
  ]);
  await runQuery(`delete from organizer where email like $1`, [
    E2E_EMAIL_PATTERN,
  ]);
  await runQuery(`delete from organizer where email = any($1::text[])`, [
    E2E_EXACT_EMAILS,
  ]);
  await runQuery(`delete from competition_host where email like $1`, [
    E2E_EMAIL_PATTERN,
  ]);
}

/** Deletes a War Week XI Competition by name, if it exists. Test cleanup. */
export async function deleteXiCompetition(name: string) {
  await runQuery(
    `delete from competition c using war_week w
     where c.war_week_id = w.id and w.edition = 'xi' and c.name = $1`,
    [name],
  );
}

/** A War Week XI Competition's id, by name. */
export async function xiCompetitionId(name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.name = $1`,
    [name],
  );
  if (!row) throw new Error(`No War Week XI Competition named "${name}"`);
  return row.id;
}

/** A War Week XI Participant's id, by display name. */
export async function xiParticipantId(displayName: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select p.id from participant p join war_week w on w.id = p.war_week_id
     where w.edition = 'xi' and p.display_name = $1`,
    [displayName],
  );
  if (!row)
    throw new Error(`No War Week XI Participant named "${displayName}"`);
  return row.id;
}

/** A War Week XI Team's id, by name. */
export async function xiTeamId(name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select t.id from team t join war_week w on w.id = t.war_week_id
     where w.edition = 'xi' and t.name = $1`,
    [name],
  );
  if (!row) throw new Error(`No War Week XI Team named "${name}"`);
  return row.id;
}

/**
 * Sets (or, with null, clears) a Participant's roster email: how a flow
 * links a stub e2e session to a Participant by account, by email.
 */
export async function setParticipantEmail(id: string, email: string | null) {
  await runQuery(`update participant set email = $1 where id = $2`, [
    email,
    id,
  ]);
}

/**
 * Runs `body` while the `edition` Participant named `displayName` has the
 * roster email `email`, then gives the Participant back its own email.
 */
export async function withParticipantEmail<T>(
  edition: string,
  displayName: string,
  email: string,
  body: () => Promise<T>,
): Promise<T> {
  const [row] = await runQuery<{ id: string; email: string | null }>(
    `select p.id, p.email from participant p join war_week w on w.id = p.war_week_id
     where w.edition = $1 and p.display_name = $2`,
    [edition, displayName],
  );
  if (!row) {
    throw new Error(
      `No War Week ${edition.toUpperCase()} Participant named "${displayName}"`,
    );
  }
  await setParticipantEmail(row.id, email);
  try {
    return await body();
  } finally {
    await setParticipantEmail(row.id, row.email);
  }
}

/**
 * A Team's Points Entries as the Points breakdown rule computes them
 * (`src/lib/points-breakdown.ts`), reimplemented directly in SQL so it's an
 * independent check of what the UI shows: entries targeting the Team
 * directly, plus entries targeting its Participants in individual
 * Competitions with Counts Toward Team on. Newest first.
 */
export async function xiTeamPointsBreakdown(
  teamName: string,
): Promise<{ competition: string; points: number; when: Date }[]> {
  const teamId = await xiTeamId(teamName);
  return runQuery<{ competition: string; points: number; when: Date }>(
    `select competition, points, "when" from (
       select c.name as competition, pe.points::float as points,
         pe.entered_at as "when", pe.id::text collate "C" as id
       from points_entry pe join competition c on c.id = pe.competition_id
       where pe.team_id = $1
       union all
       select c.name as competition, pe.points::float as points,
         pe.entered_at as "when", pe.id::text collate "C" as id
       from points_entry pe
       join competition c on c.id = pe.competition_id
       join participant p on p.id = pe.participant_id
       where c.counts_toward_team and p.team_id = $1
     ) rows
     order by "when" desc, id asc`,
    [teamId],
  );
}

/**
 * A Participant's Points Entries as the Points breakdown rule computes
 * them: entries targeting the Participant directly in individual
 * Competitions. Newest first. Independent SQL, not the app's function.
 */
export async function xiParticipantPointsBreakdown(
  displayName: string,
): Promise<{ competition: string; points: number; when: Date }[]> {
  const participantId = await xiParticipantId(displayName);
  return runQuery<{ competition: string; points: number; when: Date }>(
    `select c.name as competition, pe.points::float as points, pe.entered_at as "when"
     from points_entry pe join competition c on c.id = pe.competition_id
     where pe.participant_id = $1 and c.scoring = 'individual'
     order by pe.entered_at desc, pe.id::text collate "C" asc`,
    [participantId],
  );
}
