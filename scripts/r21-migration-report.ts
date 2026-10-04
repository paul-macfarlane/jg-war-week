/**
 * Lists every row migration 0032 (R21) drops or nulls, so the PR can carry
 * them before Migrate runs (the R21 execution plan, P10 and P10b "Listed"
 * rows): `pnpm tsx scripts/r21-migration-report.ts`, against DATABASE_URL
 * at migration 0031.
 *
 * Read-only: one read-only transaction of selects. Prints Competition,
 * Team and Participant names and counts only: never an email or the
 * database URL. Old table names (`game`, `game_player`) are the 0031
 * schema's, read here on purpose.
 */
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

loadEnvConfig(process.cwd());

type Row = Record<string, unknown>;

/** Head-to-head Games, one row per Competition, with the 0032 fate inputs. */
const HEAD_TO_HEAD = sql`
  with players as (
    select g.competition_id, g.id as game_id,
      coalesce(gp.team_id, gp.participant_id) as player_id
    from game g
    join game_player gp on gp.game_id = g.id
    join competition c on c.id = g.competition_id
    where c.format::text = 'head-to-head'
  ), per as (
    select competition_id,
      count(distinct player_id) as players,
      count(distinct game_id) as games,
      count(*) as rows
    from players group by competition_id
  )
  select c.name as competition, per.players::int, per.games::int,
    (per.players = 2 and per.games <= 7 and per.rows = 2 * per.games) as kept
  from per join competition c on c.id = per.competition_id
  order by c.name`;

/** Entrant rows 0032 drops from a Head-to-head, with why. */
const HEAD_TO_HEAD_ENTRANTS = sql`
  with players as (
    select g.competition_id,
      gp.team_id, gp.participant_id,
      coalesce(gp.team_id, gp.participant_id) as player_id, g.id as game_id
    from game g
    join game_player gp on gp.game_id = g.id
    join competition c on c.id = g.competition_id
    where c.format::text = 'head-to-head'
  ), kept as (
    select competition_id from players group by competition_id
    having count(distinct player_id) = 2
      and count(distinct game_id) <= 7
      and count(*) = 2 * count(distinct game_id)
  )
  select c.name as competition,
    coalesce(t.name, p.display_name, 'a Squad') as entrant,
    e.seed_position,
    case when k.competition_id is not null
      then 'not one of the two who played'
      else 'beyond the first two by Seed Position' end as reason
  from entrant e
  join competition c on c.id = e.competition_id
  left join team t on t.id = e.team_id
  left join participant p on p.id = e.participant_id
  left join kept k on k.competition_id = e.competition_id
  where c.format::text = 'head-to-head'
    and (
      (k.competition_id is not null and not exists (
        select 1 from players pl
        where pl.competition_id = e.competition_id
          and (pl.team_id = e.team_id or pl.participant_id = e.participant_id)))
      or (k.competition_id is null and (
        select count(*) from entrant earlier
        where earlier.competition_id = e.competition_id
          and earlier.seed_position < e.seed_position) >= 2)
    )
  order by c.name, e.seed_position`;

/** Best score Games 0032 drops: a null Score, or a team Game no Participant of that Team logged. */
const BEST_SCORE_DROPPED = sql`
  select c.name as competition, c.scoring::text as scoring,
    coalesce(t.name, p.display_name) as player,
    g.logged_at,
    case
      when gp.score is null then 'no Score'
      when g.logged_by_participant_id is null then 'logged by a Host or Organizer, so no Participant to credit'
      else 'logged by a Participant not on that Team'
    end as reason
  from game g
  join competition c on c.id = g.competition_id
  join game_player gp on gp.game_id = g.id
  left join team t on t.id = gp.team_id
  left join participant p on p.id = gp.participant_id
  left join participant logger on logger.id = g.logged_by_participant_id
  where c.format::text = 'best-score'
    and (gp.score is null
      or (c.scoring = 'team' and (logger.team_id is null
        or logger.team_id is distinct from gp.team_id)))
  order by c.name, g.logged_at`;

/** Best score Entrant rows: Best score has no Entrant list. */
const BEST_SCORE_ENTRANTS = sql`
  select c.name as competition,
    coalesce(t.name, p.display_name, 'a Squad') as entrant
  from entrant e
  join competition c on c.id = e.competition_id
  left join team t on t.id = e.team_id
  left join participant p on p.id = e.participant_id
  where c.format::text = 'best-score'
  order by c.name, e.seed_position`;

/** Bracket Match Scores that aren't numbers become null. */
const NON_NUMERIC_SCORES = sql`
  select c.name as competition, m.round, m.position,
    coalesce(t.name, p.display_name, s.name) as entrant,
    bme.score
  from bracket_match_entrant bme
  join bracket_match m on m.id = bme.bracket_match_id
  join competition c on c.id = m.competition_id
  join entrant e on e.id = bme.entrant_id
  left join team t on t.id = e.team_id
  left join participant p on p.id = e.participant_id
  left join squad s on s.id = e.squad_id
  where bme.score is not null
    and bme.score !~ '^\\s*-?\\d{1,9}(\\.\\d{1,3})?\\s*$'
  order by c.name, m.round, m.position`;

function print(title: string, rows: Row[]) {
  console.log(`\n## ${title} (${rows.length})`);
  if (rows.length === 0) {
    console.log("None.");
    return;
  }
  for (const row of rows) {
    console.log(
      `- ${Object.entries(row)
        .map(([key, value]) =>
          value instanceof Date
            ? `${key}: ${value.toISOString()}`
            : `${key}: ${String(value)}`,
        )
        .join(" · ")}`,
    );
  }
}

async function main() {
  const { db } = await import("@/db");
  await db.transaction(async (tx) => {
    await tx.execute(sql`set transaction read only`);
    const [{ present }] = (
      await tx.execute(
        sql`select to_regclass('public.game') is not null as present`,
      )
    ).rows as { present: boolean }[];
    console.log("# R21 migration 0032: rows dropped or nulled");
    if (!present) {
      console.log(
        "\nThis database is past migration 0031 (no `game` table): nothing to list.",
      );
      return;
    }
    const rows = async (query: ReturnType<typeof sql>) =>
      (await tx.execute(query)).rows as Row[];

    const headToHead = await rows(HEAD_TO_HEAD);
    const withoutKept = (row: Row): Row =>
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== "kept"));
    print(
      "Head-to-head Games dropped (more than 2 players or more than 7 Games)",
      headToHead.filter((r) => !r.kept).map(withoutKept),
    );
    print(
      "Head-to-head Games converted to Matches",
      headToHead.filter((r) => r.kept).map(withoutKept),
    );
    print(
      "Head-to-head Entrant rows dropped",
      await rows(HEAD_TO_HEAD_ENTRANTS),
    );
    print("Best score Games dropped", await rows(BEST_SCORE_DROPPED));
    print(
      "Best score Entrant rows dropped (no Entrant list)",
      await rows(BEST_SCORE_ENTRANTS),
    );
    print(
      "Bracket Match Scores that become null (not a number)",
      await rows(NON_NUMERIC_SCORES),
    );
  });
  process.exit(0);
}

main().catch((error: unknown) => {
  // The message only: a connection error can carry the URL.
  console.error(
    "r21-migration-report failed:",
    error instanceof Error
      ? error.message.replace(/postgres(ql)?:\/\/\S+/g, "[database]")
      : "unknown error",
  );
  process.exit(1);
});
