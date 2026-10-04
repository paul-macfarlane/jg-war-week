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

/**
 * Deletes the Award Categories an e2e run added: only the seeded ones have a
 * `key`. Awards go with their War Week's reset first (`on delete restrict`).
 */
export async function deleteE2eAwardCategories() {
  await runQuery(
    `delete from award_category c where c.key is null
     and not exists (select 1 from award a where a.category_id = c.id)`,
  );
}

/**
 * Gives War Week XI back the default Finale: no saved slide list (so it
 * plays Title, By the numbers, Awards, Winners, Standings countdown,
 * Winner) and the one-slide Awards layout. Each Finale slide spec calls it
 * before and after its flows.
 */
export async function resetXiFinaleSlides() {
  await runQuery(
    `delete from finale_slide s using war_week w
     where s.war_week_id = w.id and w.edition = 'xi'`,
  );
  await runQuery(
    `update war_week set finale_awards_layout = 'one-slide' where edition = 'xi'`,
  );
}

/** Deletes a War Week XI Competition by name, if it exists. Test cleanup. */
export async function deleteXiCompetition(name: string) {
  await runQuery(
    `delete from competition c using war_week w
     where c.war_week_id = w.id and w.edition = 'xi' and c.name = $1`,
    [name],
  );
}

/**
 * The Points Entries of a War Week XI Competition, by Participant name (or
 * Team name), as an independent check of what Close wrote: `war_week_id` is
 * the War Week's, whoever it targets.
 */
export async function xiCompetitionEntries(
  name: string,
): Promise<{ target: string; points: number; generated: boolean }[]> {
  return runQuery<{ target: string; points: number; generated: boolean }>(
    `select coalesce(p.display_name, t.name) as target,
       pe.points::float as points, pe.generated as generated
     from points_entry pe
     join war_week w on w.id = pe.war_week_id and w.edition = 'xi'
     left join competition c on c.id = pe.competition_id
     left join participant p on p.id = pe.participant_id
     left join team t on t.id = pe.team_id
     where c.name = $1
     order by target`,
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
 * Competitions with Counts Toward Team on, plus Discretionary points (no
 * Competition, labelled "Discretionary: <reason>") targeting its
 * Participants. Scoped by `war_week_id`, so a Discretionary entry counts.
 * Newest first.
 */
export async function xiTeamPointsBreakdown(
  teamName: string,
): Promise<{ competition: string; points: number; when: Date }[]> {
  const teamId = await xiTeamId(teamName);
  return runQuery<{ competition: string; points: number; when: Date }>(
    `select competition, points, "when" from (
       select coalesce(c.name, 'Discretionary: ' || pe.note) as competition,
         pe.points::float as points,
         pe.entered_at as "when", pe.id::text collate "C" as id
       from points_entry pe left join competition c on c.id = pe.competition_id
       where pe.team_id = $1
       union all
       select coalesce(c.name, 'Discretionary: ' || pe.note) as competition,
         pe.points::float as points,
         pe.entered_at as "when", pe.id::text collate "C" as id
       from points_entry pe
       left join competition c on c.id = pe.competition_id
       join participant p on p.id = pe.participant_id
       where (pe.competition_id is null or c.counts_toward_team)
         and p.team_id = $1
     ) rows
     order by "when" desc, id asc`,
    [teamId],
  );
}

/**
 * A Participant's Points Entries as the Points breakdown rule computes
 * them: entries targeting the Participant directly in individual
 * Competitions, plus Discretionary points. Newest first. Independent SQL,
 * not the app's function.
 */
export async function xiParticipantPointsBreakdown(
  displayName: string,
): Promise<{ competition: string; points: number; when: Date }[]> {
  const participantId = await xiParticipantId(displayName);
  return runQuery<{ competition: string; points: number; when: Date }>(
    `select coalesce(c.name, 'Discretionary: ' || pe.note) as competition,
       pe.points::float as points, pe.entered_at as "when"
     from points_entry pe left join competition c on c.id = pe.competition_id
     where pe.participant_id = $1
       and (pe.competition_id is null or c.scoring = 'individual')
     order by pe.entered_at desc, pe.id::text collate "C" asc`,
    [participantId],
  );
}

/** A Competition's Bracket-related columns, to put back after a spec built one. */
export type BracketSnapshot = {
  format: string | null;
  bracket_config: unknown;
  self_enroll: boolean;
  entrant_limit: number | null;
  self_report: boolean;
  closed_at: Date | null;
  score_direction: string;
  /** A move to a Bracket keeps only the first 4 places (ticket 101). */
  placement_points: string | null;
};

export async function snapshotBracket(
  competitionId: string,
): Promise<BracketSnapshot> {
  const [row] = await runQuery<BracketSnapshot>(
    `select format::text as format, bracket_config, self_enroll,
       entrant_limit, self_report, closed_at,
       score_direction::text as score_direction,
       placement_points::text as placement_points
     from competition where id = $1`,
    [competitionId],
  );
  return row;
}

/** Drops the Competition's Matches and Entrants and restores its snapshot. */
export async function restoreBracket(
  competitionId: string,
  snapshot: BracketSnapshot,
) {
  await runQuery(`delete from bracket_match where competition_id = $1`, [
    competitionId,
  ]);
  await runQuery(`delete from entrant where competition_id = $1`, [
    competitionId,
  ]);
  await runQuery(
    `update competition set format = $2::competition_format,
       bracket_config = $3, self_enroll = $4, closed_at = $5,
       score_direction = $6::score_direction, self_report = $7,
       placement_points = $8::numeric[], entrant_limit = $9
     where id = $1`,
    [
      competitionId,
      snapshot.format,
      snapshot.bracket_config === null
        ? null
        : JSON.stringify(snapshot.bracket_config),
      snapshot.self_enroll,
      snapshot.closed_at,
      snapshot.score_direction,
      snapshot.self_report,
      snapshot.placement_points,
      snapshot.entrant_limit,
    ],
  );
}

/**
 * The seeded individual Competitions are Closed Placement sheets (R16),
 * and a Closed Competition's Format is locked. A Bracket flow calls this
 * first: it snapshots the Competition (Format, Bracket settings, its
 * Placements and Points Entries), then clears them and reopens it so a
 * Bracket can be built. The returned function puts everything back; call it
 * in `finally` or `afterEach`.
 */
export async function openForBracket(
  competitionId: string,
): Promise<() => Promise<void>> {
  const bracket = await snapshotBracket(competitionId);
  const [saved] = await runQuery<{ placements: string; entries: string }>(
    `select
       (select coalesce(json_agg(row_to_json(p)), '[]'::json)
        from placement p where p.competition_id = $1)::text as placements,
       (select coalesce(json_agg(row_to_json(e)), '[]'::json)
        from points_entry e where e.competition_id = $1)::text as entries`,
    [competitionId],
  );
  await runQuery(`delete from points_entry where competition_id = $1`, [
    competitionId,
  ]);
  await runQuery(`delete from placement where competition_id = $1`, [
    competitionId,
  ]);
  await runQuery(`update competition set closed_at = null where id = $1`, [
    competitionId,
  ]);
  return async () => {
    await restoreBracket(competitionId, bracket);
    await runQuery(`delete from points_entry where competition_id = $1`, [
      competitionId,
    ]);
    await runQuery(`delete from placement where competition_id = $1`, [
      competitionId,
    ]);
    await runQuery(
      `insert into placement select * from json_populate_recordset(null::placement, $1::json)`,
      [saved.placements],
    );
    await runQuery(
      `insert into points_entry select * from json_populate_recordset(null::points_entry, $1::json)`,
      [saved.entries],
    );
  };
}
