import { Client } from "pg";

import { E2E_EMAIL_PATTERN } from "./env";

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
 * Deletes every e2e user (their sessions cascade), Organizer row and Host
 * row (the e2e Host's `competition_host` rows).
 */
export async function deleteE2eUsers() {
  await runQuery(`delete from "user" where email like $1`, [E2E_EMAIL_PATTERN]);
  await runQuery(`delete from organizer where email like $1`, [
    E2E_EMAIL_PATTERN,
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
 * links a stub e2e session to a Participant by account, without the pick.
 */
export async function setParticipantEmail(id: string, email: string | null) {
  await runQuery(`update participant set email = $1 where id = $2`, [
    email,
    id,
  ]);
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
    `select c.name as competition, pe.points::float as points, pe.entered_at as "when"
     from points_entry pe join competition c on c.id = pe.competition_id
     where pe.team_id = $1
     union all
     select c.name as competition, pe.points::float as points, pe.entered_at as "when"
     from points_entry pe
     join competition c on c.id = pe.competition_id
     join participant p on p.id = pe.participant_id
     where c.counts_toward_team and p.team_id = $1
     order by "when" desc`,
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
     order by pe.entered_at desc`,
    [participantId],
  );
}
