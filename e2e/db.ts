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

/** Deletes every e2e user (their sessions cascade) and Organizer row. */
export async function deleteE2eUsers() {
  await runQuery(`delete from "user" where email like $1`, [E2E_EMAIL_PATTERN]);
  await runQuery(`delete from organizer where email like $1`, [
    E2E_EMAIL_PATTERN,
  ]);
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
